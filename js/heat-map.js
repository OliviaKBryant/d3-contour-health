class HeatMapVis {

    constructor(parentElement, countyData, stateData, contourParameter,majorCities){
        this.parentElement = parentElement;
        this.countyData = countyData;
        this.stateData = stateData;
        this.contourParameter = contourParameter;
        this.majorCities = majorCities;
        this.displayData = [];

        this.initVis();
    }

    initVis() {
        let vis = this;

        // margin conventions
        vis.margin = {top: 30, right: 30, bottom: 30, left: 30};
        vis.width = $("#" + vis.parentElement).width() - vis.margin.left - vis.margin.right;
        vis.height = $("#" + vis.parentElement).height() - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select(`#${this.parentElement}`).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)

        vis.visGroup = vis.svg.append("g")
            .attr("transform","translate(" + vis.margin.left + "," + vis.margin.top + ")")
            .attr("class",`visGroup`)
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)

        // set up scale
        vis.x = d3.scaleLinear()
            .rangeRound([vis.margin.left*2, vis.width - vis.margin.right*2])

        vis.y = d3.scaleLinear()
            .rangeRound([vis.height - vis.margin.bottom*2, vis.margin.top*2])

        // append legend group
        vis.legend = vis.svg.append("g")
            .attr('class', 'heatmap-legend')
            .attr('transform', 'translate(' + vis.margin.left*3 + ',' + (vis.height) + ')');

        // append legend defs
        vis.legendDefs = vis.legend.append("defs");

        // Append a linearGradient element to the defs and give it a unique id
        vis.linearGradient = vis.legendDefs.append("linearGradient")
            .attr("id", "heatmap-linear-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        // Set the color for the start (0%)
        vis.linearGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "white");

        // Set the color for the end (100%)
        vis.linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", '#f47b66');

        // Draw the rectangle and fill with gradient
        vis.legend.append("rect")
            .attr("width", 180)
            .attr("height", 12)
            .attr('stroke','white')
            .style("fill", "url(#heatmap-linear-gradient)");

        // init legend scale
        vis.scaleLegend = d3.scaleLinear()
            .range([0,180])

        // init legend axis
        vis.axisLegend = d3.axisBottom()
            .scale(vis.scaleLegend)
            .ticks(5);

        vis.wrangleData();
    }

    wrangleData(){
        let vis = this;

        vis.hmRawData();
        vis.hmDisplayData();
        vis.hmVoronoiDataSteps();

    }

    hmRawData(){
        let vis = this;

        this.selectedIssue = document.querySelector('input[name="inlineRadioOptions"]:checked').value
        this.selectedState = $('#stateSelector').val();

        vis.selectedCountyData = [];

        // prepare data for text labels
        if(vis.selectedState == 'allStates'){
            vis.selectedCountyData = vis.countyData;
        }else{
            for(let i=0; i < vis.countyData.length; i++){
                if(vis.countyData[i].State == vis.selectedState){
                    vis.selectedCountyData.push(vis.countyData[i]);
                }
            }
        }

        vis.selectedCountyData.sort((a,b)=>{return b[vis.selectedIssue]-a[vis.selectedIssue]});
        vis.stateData.sort((a,b)=>{return b[vis.selectedIssue]-a[vis.selectedIssue]});

        vis.selectedCities = [];

        if(vis.selectedState == 'allStates'){
            vis.selectedCities = vis.majorCities;
        }else{
            for(let i=0; i < vis.majorCities.length; i++){
                if(vis.majorCities[i].State == vis.selectedState){
                    vis.selectedCities.push(vis.majorCities[i]);
                }
            }
        }
        console.log('sortedCounty',vis.selectedCountyData);
        console.log('sortedState',vis.stateData);
        console.log('selected cities',vis.selectedCities);
    }

    hmDisplayData(){
        let vis = this;

        vis.displayData = [];

        // prepare dataset for making the contours
        for(let i=0; i < vis.selectedCountyData.length; i++){
            let latitude = vis.selectedCountyData[i].Latitude;
            let longitude = vis.selectedCountyData[i].Longitude;

            let repeat = vis.selectedCountyData[i][vis.selectedIssue];

            for(let j=0; j < repeat; j++){
                vis.displayData.push(
                    {
                        Latitude: latitude,
                        Longitude: longitude
                    }
                )
            }
        }

        // get bandwidth and thresholds for the current selection
        vis.selectedStateObject = vis.contourParameter.find(object => object.State == [vis.selectedState]);
        if(vis.selectedIssue == 'PercentageSingleParent'){
            vis.bandwidth = vis.selectedStateObject.BandwidthDrink;
            vis.threshold = vis.selectedStateObject.ThresholdDrink;
        }else if(vis.selectedIssue == 'PercentageDrivingDeath'){
            vis.bandwidth = vis.selectedStateObject.BandwidthDriv;
            vis.threshold = vis.selectedStateObject.ThresholdDriv;
        }

        // update scale
        vis.x
            .domain(d3.extent(vis.displayData, d => d.Longitude)).nice()

        vis.y
            .domain(d3.extent(vis.displayData, d => d.Latitude)).nice()

        console.log('displayData',vis.displayData);

    }

    hmVoronoiDataSteps(){
        let vis = this;

        vis.lons = d3.range(10,55,1).reverse();
        vis.lats = d3.range(-130,-60,1);

        vis.rawGridPoints = vis.lons.map((lon,i)=>vis.lats.map(lat=>[lat,lon])).flat();

        vis.geojsonGridPoints = vis.rawGridPoints.map((d,i)=>{
            return {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": d
                },
                "properties": {
                    "index": i
                }
            }
        });

        vis.voronoiDiagram = d3.voronoi()
            .x(d => vis.x(d.geometry.coordinates[0]))
            .y(d => vis.y(d.geometry.coordinates[1]))
            (vis.geojsonGridPoints);

        vis.countyFeatures = [];

        for(let i=0; i < vis.selectedCountyData.length; i++){
            let coordinates = [vis.selectedCountyData[i].Longitude,vis.selectedCountyData[i].Latitude];

            vis.countyFeatures.push({
                type:"Feature",
                properties: vis.selectedCountyData[i],
                geometry:{
                    type:"Point",
                    coordinates: coordinates
                }
            })
        }
        vis.updateVis();
    }

    updateVis(){
        let vis = this;

        vis.dots = vis.visGroup.selectAll('circle')
            .data(vis.geojsonGridPoints);

        vis.dots.enter()
            .append('circle')
            .merge(vis.dots)
            .attr('cx',d => vis.x(d.geometry.coordinates[0]))
            .attr('cy',d => vis.y(d.geometry.coordinates[1]))
            .attr('r',1)
            .attr('fill','none')
            .transition()
            .duration(1000)
            .attr('fill','#949494')

        vis.dots
            .exit()
            .remove();

        vis.updateContours();
        vis.updateLegend();
        vis.updateText();
        vis.updateCity();
        vis.updateHTML();

    }

    updateContours(){
        let vis = this;

        // get dataset for the contours
        vis.contourData = d3.contourDensity()
            .x(d => vis.x(d.Longitude))
            .y(d => vis.y(d.Latitude))
            .size([vis.width, vis.height])
            .bandwidth(vis.bandwidth)
            .thresholds(vis.threshold)
            (vis.displayData)

        console.log(vis.contourData);

        // set up color
        vis.interpolateRed = d3.interpolate('whitesmoke','#f47b66');
        vis.colorScale = d3.scaleSequential(d3.extent(vis.contourData, d => d.value),vis.interpolateRed)

        // ENTER-UPDATE-EXIT for the contours
        // create contours
        vis.contours = vis.visGroup.selectAll('path')
            .data(vis.contourData);

        // enter
        vis.contours.enter()
            .append('path')
            .merge(vis.contours) //update
            .join('path')
            .attr("fill", d => vis.colorScale(d.value))
            .attr('opacity',0)
            .attr("stroke-width", 0.5)
            .attr("stroke", "white")
            .attr("stroke-linejoin", "round")
            .attr("d", d3.geoPath())
            .attr('transform',function(){
                if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                    return 'scale(' + 0.5 + ') translate(' + vis.width/2 + ',' + vis.height/2 + ')';
                }else if(vis.selectedState == 'Texas'){
                    return 'scale(' + 1 + ') translate(' + 0 + ',' + 0 + ')';
                }else if(vis.selectedState == "Alabama"){
                    return 'scale(' + 0.7 + ') translate(' + vis.width*0.25 + ',' + vis.height*0.2 + ')';
                }else if(vis.selectedState !== "allStates"){
                    return 'scale(' + 0.8 + ') translate(' + vis.width*0.1 + ',' + vis.height*0.1 + ')';
                }
            })
            .transition()
            .duration(1000)
            .attr('opacity',0.8);

        // exit
        vis.contours
            .exit()
            .remove();

    }

    updateLegend(){
        let vis = this;

        // update legend scale and setup
        if(vis.selectedState == 'allStates'){
            vis.scaleLegend.domain([d3.min(vis.stateData,d=>d[vis.selectedIssue]),d3.max(vis.stateData,d=>d[vis.selectedIssue])]);
        }else{
            vis.scaleLegend.domain([d3.min(vis.selectedCountyData,d=>d[vis.selectedIssue]),d3.max(vis.selectedCountyData,d=>d[vis.selectedIssue])]);
        }
        vis.axisLegend
            .ticks(5);

        // remove old axis
        d3.selectAll('.heatmap-legend-x-axis').remove()

        // draw axis

        vis.drawnLegendAxis = vis.legend.append("g")
            .attr("class", "heatmap-legend-x-axis")
            .attr('transform','translate(' + 0 + ',' + 13 + ')')
            .call(vis.axisLegend);

        vis.drawnLegendAxis.selectAll('path')
            .attr('stroke','#4F4F51')

        vis.legend.append('text')
            .attr("class", "heatmap-legend-x-axis")
            .text('(%)')
            .attr('transform','translate(' + 190 + ',' + 30 + ')')
            .attr('font-size','12px')
            .attr('font-weight',500)

    }

    updateText(){
        let vis = this;

        // ENTER-UPDATE-EXIT for text
        // append text
        d3.selectAll('.heatmap-text-label').remove();

        vis.labels = vis.visGroup.selectAll('text')
            .data(function(){
                if(vis.selectedState == 'allStates'){
                    return vis.stateData;
                }else{
                    return vis.selectedCountyData;
                }
            })

        vis.labels.enter()
            .append('text')
            .merge(vis.labels)
            .attr('x', d => vis.x(d.Longitude))
            .attr('y', d => vis.y(d.Latitude))
            .text(function(d,i){
                if(vis.selectedState == 'allStates'){
                    return d.State;
                }else if(i==0 || i == vis.selectedCountyData.length -1){
                    return  d.County ;
                }else{
                    return d.County;
                }
            })
            .attr("class","heatmap-text-label")
            // .attr('text-decoration',function(d,i){
            //     if(i==0 || i == vis.selectedCountyData.length -1){
            //         return 'underline';
            //     }
            // })
            .attr('font-weight',function(d,i){
                if(i==0 || i == vis.selectedCountyData.length -1){
                    return 700;
                }else{
                    return 500;
                }
            })
            .attr("font-size",function(){
                if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                    return '22px';
                }else if(vis.selectedState == 'Texas'){
                    return '11px';
                }else if(vis.selectedState == "Alabama"){
                    return '16px';
                }else if(vis.selectedState !== "allStates"){
                    return '14px'
                }else if(vis.selectedState == "allStates"){
                    return 11;
                }
            })
            .attr('fill', function(d,i){
                if(i==0 || i == vis.selectedCountyData.length -1){
                    return "black";
                }else{
                    return "#404040";
                }
            })
            .attr("text-anchor","middle")
            .attr('transform',function(){
                if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                    return 'scale(' + 0.5 + ') translate(' + vis.width/2 + ',' + vis.height/2 + ')';
                }else if(vis.selectedState == 'Texas'){
                    return 'scale(' + 1 + ') translate(' + 0 + ',' + 0 + ')';
                }else if(vis.selectedState == "Alabama"){
                    return 'scale(' + 0.7 + ') translate(' + vis.width*0.25 + ',' + vis.height*0.2 + ')';
                }else if(vis.selectedState !== "allStates"){
                    return 'scale(' + 0.8 + ') translate(' + vis.width*0.1 + ',' + vis.height*0.1 + ')';
                }
            })
            .on('click',function(event,d){
                if(vis.selectedState !== "allStates"){
                    console.log("selectedCounty");
                }else{
                    vis.stateToSelect = d.State;
                    $('#stateSelector option:contains(' + vis.stateToSelect +')').attr('selected','selected');
                    selectionChange();
                }
            })
            .on('mouseout',function(event,d){
                d3.select(this)
                    .transition()
                    .duration(300)
                    .attr("font-size",function(){
                        if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                            return '22px';
                        }else if(vis.selectedState == 'Texas'){
                            return '11px';
                        }else if(vis.selectedState == "Alabama"){
                            return '16px';
                        }else if(vis.selectedState !== "allStates"){
                            return '14px'
                        }else if(vis.selectedState == "allStates"){
                            return '11px';
                        }
                    })
                    .attr("cursor","default")
                    .attr("stroke","none")
                    .attr("stroke-width",0);

                d3.select(".heatmap-state-stat")
                    .transition()
                    .duration(300)
                    .attr('opacity',0)
                    .attr('font-size','11px')
                    .remove();

                vis.deleteHTML();
            })
            .on('mouseover',function(event,d){
                d3.select(this)
                    .transition()
                    .duration(300)
                    .attr("font-size",function(){
                        if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                            return '36px';
                        }else if(vis.selectedState == 'Texas'){
                            return '18px';
                        }else if(vis.selectedState == "Alabama"){
                            return '26px';
                        }else if(vis.selectedState !== "allStates"){
                            return '22.5px'
                        }else if(vis.selectedState == "allStates"){
                            return '18px';
                        }
                    })
                    .attr("cursor","pointer")
                    // .attr("stroke","#bb9b64ff")
                    // .attr("stroke-width","0.4px")
                    .attr("font-weight",700);

                let heatmapDigit = d[vis.selectedIssue];
                let heatmapDigitX = vis.x(d.Longitude);
                let heatmapDigitY = vis.y(d.Latitude)-20;

                if(vis.selectedState == 'allStates'){

                    d3.select(".heatmap-state-stat").remove();

                    vis.visGroup.append('text')
                        .attr('class','heatmap-state-stat')
                        .text(heatmapDigit + "%")
                        .attr('x', heatmapDigitX)
                        .attr('y', heatmapDigitY)
                        .attr('font-size','11px')
                        .attr('font-weight',700)
                        .attr('text-anchor','middle')
                        .attr('fill', "#404040")
                        .attr("opacity",0)
                        .transition()
                        .duration(300)
                        .attr('font-size','24px')
                        .attr("opacity",1)
                }

                vis.insertHTML(d);
            })
            .attr("opacity",0)
            .transition()
            .duration(1000)
            .attr('opacity', function(d,i){
                if(vis.selectedState == 'allStates' || i == 0 || i == vis.selectedCountyData.length -1){
                    return 1;
                }else{
                    return 0.5;
                }
            })

        vis.labels
            .exit()
            .remove();
    }

    updateCity(){
        let vis = this;

        if(vis.selectedState == 'allStates'){
            d3.selectAll('.heatmap-cities').remove();
            d3.selectAll('.heatmap-city-labels').remove();
        }else{
            //append cities
            vis.cities = vis.visGroup.selectAll('.heatmap-cities')
                .data(vis.selectedCities);

            vis.cities.enter()
                .append('circle')
                .attr('class','heatmap-cities')
                .merge(vis.cities)
                .attr('cx', d => vis.x(d.Longitude) - 6.5)
                .attr('cy', d => vis.y(d.Latitude) - 6.5)
                .attr('fill','white')
                .attr('stroke','black')
                .attr('transform',function(){
                    if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                        return 'scale(' + 0.5 + ') translate(' + vis.width/2 + ',' + vis.height/2 + ')';
                    }else if(vis.selectedState == 'Texas'){
                        return 'scale(' + 1 + ') translate(' + 0 + ',' + 0 + ')';
                    }else if(vis.selectedState == "Alabama"){
                        return 'scale(' + 0.7 + ') translate(' + vis.width*0.25 + ',' + vis.height*0.2 + ')';
                    }else if(vis.selectedState !== "allStates"){
                        return 'scale(' + 0.8 + ') translate(' + vis.width*0.1 + ',' + vis.height*0.1 + ')';
                    }
                })
                .attr('r',function(){
                    if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                        return 8;
                    }else if(vis.selectedState == 'Texas'){
                        return 4;
                    }else if(vis.selectedState == "Alabama"){
                        return 5.7;
                    }else if(vis.selectedState !== "allStates"){
                        return 5;
                    }
                })
                .attr('font-weight',500)
                .attr("opacity",0)
                .transition()
                .duration(1000)
                .attr("opacity",1)


            vis.cities
                .exit()
                .remove();

            //append city labels
            vis.cityLabels = vis.visGroup.selectAll('.heatmap-city-labels')
                .data(vis.selectedCities);

            vis.cityLabels.enter()
                .append('text')
                .merge(vis.cityLabels)
                .attr('class','heatmap-city-labels')
                .attr('x', d => vis.x(d.Longitude))
                .attr('y', d => vis.y(d.Latitude))
                .text(d => d.City)
                .attr('fill','white')
                .attr('font-weight',500)
                .attr('transform',function(){
                    if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                        return 'scale(' + 0.5 + ') translate(' + vis.width/2 + ',' + vis.height/2 + ')';
                    }else if(vis.selectedState == 'Texas'){
                        return 'scale(' + 1 + ') translate(' + 0 + ',' + 0 + ')';
                    }else if(vis.selectedState == "Alabama"){
                        return 'scale(' + 0.7 + ') translate(' + vis.width*0.25 + ',' + vis.height*0.2 + ')';
                    }else if(vis.selectedState !== "allStates"){
                        return 'scale(' + 0.8 + ') translate(' + vis.width*0.1 + ',' + vis.height*0.1 + ')';
                    }
                })
                .attr('font-size',function(){
                    if(vis.selectedState == "Delaware" || vis.selectedState == "Connecticut" || vis.selectedState == "Rhode Island"){
                        return 28;
                    }else if(vis.selectedState == 'Texas'){
                        return 14;
                    }else if(vis.selectedState == "Alabama"){
                        return 19;
                    }else if(vis.selectedState !== "allStates"){
                        return 17;
                    }
                })
                .attr("opacity",0)
                .transition()
                .duration(1000)
                .attr("opacity",1)


            vis.cities
                .exit()
                .remove();
        }

        console.log('cities', vis.selectedCities);
    }

    insertHTML(d){
        let vis = this;

        if(vis.selectedState == 'allStates'){
            document.getElementById('heatmap-10').innerHTML = d[vis.selectedIssue] + '%';
            document.getElementById('heatmap-12').innerHTML = d.State;
            document.getElementById('heatmap-18').innerHTML = 'of';
            document.getElementById('heatmap-19').innerHTML = 'in';
            if(vis.selectedIssue == 'ExcessiveDrinking'){
                document.getElementById('heatmap-11').innerHTML = 'adults';
                document.getElementById('heatmap-13').innerHTML = 'have reported to have done binge or excessive drinking in the past year.' ;
            }else{
                document.getElementById('heatmap-11').innerHTML = 'car accidents';
                document.getElementById('heatmap-13').innerHTML = 'were found to have alcohol involved in the past year';
            }
        }else {
            document.getElementById('heatmap-14').innerHTML = d[vis.selectedIssue] + '%';
            document.getElementById('heatmap-16').innerHTML = d.County + ' County';
            document.getElementById('heatmap-20').innerHTML = 'of';
            document.getElementById('heatmap-21').innerHTML = 'in';
            if (vis.selectedIssue == 'ExcessiveDrinking') {
                document.getElementById('heatmap-15').innerHTML = 'adults';
                document.getElementById('heatmap-17').innerHTML = 'have reported to have done binge or excessive drinking in the past year.';
            } else {
                document.getElementById('heatmap-15').innerHTML = 'car accidents';
                document.getElementById('heatmap-17').innerHTML = 'were found to have alcohol involved in the past year';
            }
        }

    }

    deleteHTML() {
        let vis = this;

        if(vis.selectedState == 'allStates'){
            document.getElementById('heatmap-10').innerHTML = '';
            document.getElementById('heatmap-11').innerHTML = '';
            document.getElementById('heatmap-12').innerHTML = '';
            document.getElementById('heatmap-13').innerHTML = '';
            document.getElementById('heatmap-18').innerHTML = '';
            document.getElementById('heatmap-19').innerHTML = '';
        }else{
            document.getElementById('heatmap-14').innerHTML = '';
            document.getElementById('heatmap-15').innerHTML = '';
            document.getElementById('heatmap-16').innerHTML = '';
            document.getElementById('heatmap-17').innerHTML = '';
            document.getElementById('heatmap-20').innerHTML = '';
            document.getElementById('heatmap-21').innerHTML = '';
        }

    }

    updateHTML(){
        let vis = this;

        if(vis.selectedState == 'allStates'){
            $('#heatmap-navigationDiv').hide()

            $('#heat-map-stateDiv').empty()
            $('#heat-map-stateDiv').append("All States")

            //update html text description
            $('#heatmap-descriptionDiv').empty()
            d3.select('#heatmap-descriptionDiv')
                .html(`
                      <p>
                      </p>
                     `)

            let heatmap1 = vis.stateData[0].State;
            let heatmap2 = vis.stateData[vis.stateData.length-1].State;
            let heatmap3 = vis.selectedCountyData[0].County;
            let heatmap4 = vis.selectedCountyData[0].State;
            let heatmap5 = vis.selectedCountyData[vis.selectedCountyData.length-1].County;
            let heatmap6 = vis.selectedCountyData[vis.selectedCountyData.length-1].State;

            let sum=0;
            for(let i=0; i<vis.stateData.length; i++){
                sum = sum + vis.stateData[i][vis.selectedIssue];
            }
            let average = sum/vis.stateData.length;
            let heatmap7 = average.toFixed(2);

            $('#heatmap-hintDiv').empty()
            d3.select('#heatmap-hintDiv')
                .html(`
                    <div>
                        <div style="margin-top:10px; color:#4F4F51">
                            *Heatmap shows the overall distribution.
                        </div>
                    </div>
                `)


        }else{
            vis.allStates = "allStates";
            $('#heatmap-navigationDiv').show()
                .on('click', $('#stateSelector'), function(){
                    $('#stateSelector').val(vis.allStates);
                    selectionChange();
                })

            $('#heat-map-stateDiv').empty()
            $('#heat-map-stateDiv').append(vis.selectedState)

            //update html text description
            $('#heatmap-descriptionDiv').empty()
            d3.select('#heatmap-descriptionDiv')
                .html(`
                      <p>
                        <span>In the state of</span>
                        <span id="heatmap-1"></span>
                        <span id="heatmap-2" style="text-decoration: underline;"></span>
                        <span>has the most</span>
                        <span id="heatmap-3">percentage of adults reporting binge or heavy drinking,</span>
                        <span>while</span>
                        <span id="heatmap-4" style="text-decoration: underline;"></span>
                        <span>has the least.</span>
                        <br><br>
                        <span>The percentage range in</span>
                        <span style="text-decoration: underline;" id="heatmap-5"></span>
                        <span>for</span>
                        <span id="heatmap-9"></span>
                        <span>is</span>
                        <span style="text-decoration: none;" id="heatmap-6"></span>
                        <span>-</span>
                        <span style="text-decoration: none;" id="heatmap-7"></span>
                        <span>, and the overall average in this state is </span>
                        <span style="text-decoration: none;" id="heatmap-8"></span>
                        <br><br>
                        <span style="text-decoration: none; font-size: 25px; font-weight: 700; color:#7f6436ff;" id="heatmap-14"></span>
                        <span style="color:#bb9b64; font-weight: 700; " id="heatmap-20"></span>
                        <span style="color:#bb9b64; font-weight: 700; " id="heatmap-15"></span>
                        <span style="color:#bb9b64; font-weight: 700; " id="heatmap-21"></span>
                        <span style="text-decoration: none;font-size: 18px;font-weight: 700; color:#7f6436ff;" id="heatmap-16"></span>
                        <span style="color:#bb9b64; font-weight: 700; " id="heatmap-17"></span>
                      </p>
                     `)
            let heatmap2 = vis.selectedCountyData[0].County;
            let heatmap4 = vis.selectedCountyData[vis.selectedCountyData.length-1].County;
            let heatmap6 = d3.min(vis.selectedCountyData, d=>d[vis.selectedIssue]);
            let heatmap7 = d3.max(vis.selectedCountyData, d=>d[vis.selectedIssue]);

            let sum=0;
            for(let i=0; i<vis.selectedCountyData.length; i++){
                sum = sum + vis.selectedCountyData[i][vis.selectedIssue];
            }
            let average = sum/vis.selectedCountyData.length;
            let heatmap8 = average.toFixed(2);

            document.getElementById('heatmap-1').innerHTML = $('#stateSelector').val() + ',';
            document.getElementById('heatmap-2').innerHTML = heatmap2 + ' County';
            document.getElementById('heatmap-4').innerHTML = heatmap4 + ' County';
            document.getElementById('heatmap-5').innerHTML = $('#stateSelector').val();
            document.getElementById('heatmap-6').innerHTML = heatmap6 + '%';
            document.getElementById('heatmap-7').innerHTML = heatmap7 + '%';
            document.getElementById('heatmap-8').innerHTML = heatmap8 + '%';

            if(vis.selectedIssue == 'ExcessiveDrinking'){
                document.getElementById('heatmap-3').innerHTML = 'percentage of adults reporting binge or heavy drinking,';
                document.getElementById('heatmap-9').innerHTML = 'excessive drinking';
            }else{
                document.getElementById('heatmap-3').innerHTML = 'percentage of driving deaths with alcohol involvement,';
                document.getElementById('heatmap-9').innerHTML = 'alcohol-involved driving deaths';
            }

            //update navigation
            document.getElementById('heatmap-hintDiv').innerHTML = '';
            document.getElementById('heatmap-hintDiv').innerHTML = `
            <p>
                <i class="fa fa-hand-pointer-o"></i> <b style="color:#4F4F51">Hover over each county name to see the stats</b>
            </p>
            `;
        }
    }

}