//==========================
// set up initial nodes and links
//  - nodes are known by 'id', not by index in array.
//  - reflexive edges are indicated on the node (as a bold black circle).
//  - links are always source < target;
//  - edge directions (saw in the UI) are set by 'left' and 'right'.
//==========================
// var nodes = [
//     {id: 0, reflexive: false},
//     {id: 1, reflexive: true },
//     {id: 2, reflexive: false}
//   ],
//   lastNodeId = 2,
//   links = [
//     {source: nodes[0], target: nodes[1], left: false, right: true },
//     {source: nodes[1], target: nodes[2], left: false, right: true }
//   ];



var nodes = [], lastNodeId = -1, links = [], layers = [];
var params = [];
var currentObject = null;
//==========================
// set up SVG for D3
//==========================
var width  = 700,
    height = 800,
    colors = d3.scale.category10();

var shiftKey = false;

var svg = d3.select('#draw')
  .on("keydown.brush", keydown)
  .on("keyup.brush", keyup)
  .each(function() { this.focus(); })
  .attr('oncontextmenu', 'return false;') // disable right-click content menue
  .append('svg')
  .attr('width', width)
  .attr('height', height);

var brusher = d3.svg.brush()
        .x(d3.scale.identity().domain([0, width]))
        .y(d3.scale.identity().domain([0, height]))
        .on("brushstart", function(d) {
          circle.each(function(d) {
           d.previouslySelected = shiftKey && d.selected; });
        })
        .on("brush", function() {
          var extent = d3.event.target.extent();
          circle.classed("selected", function(d) {
            return d.selected = d.previouslySelected ^
                (extent[0][0] <= d.x && d.x < extent[1][0]
                && extent[0][1] <= d.y && d.y < extent[1][1]);
          });
        })
        .on("brushend", function() {
          d3.event.target.clear();
          d3.select(this).call(d3.event.target);
          cur_layer = [];
          document.getElementById('view_select').innerHTML = '';
          d3.selectAll('circle').each(
            function(d){
              if (d.selected){
                cur_layer.push(d);
              }
            }
          );

          d3.selectAll('circle').style('stroke', function(d) {
            return (d.selected)? 'red': d3.rgb(colors(d.id)).darker().toString();
          })

          //layers.push(cur_layer);
          document.getElementById('view_select').innerHTML = '<p>'+flatLayer(cur_layer)+'<button type = "button" onclick = "groupNodes(cur_layer)" >Group</button></p>';
          //document.getElementById('view_layers').innerHTML = JSON.stringify(layers, null, 1);
        }),
    brush = svg.append("g")
      .datum(function() { return {selected: false, previouslySelected: false}; })
      .attr("class", "brush");

    brush.call(brusher)
      .on("mousedown.brush", null)
      .on("touchstart.brush", null)
      .on("touchmove.brush", null)
      .on("touchend.brush", null);

    brush.select('.background').style('cursor', 'default');

function flatLayer(layer){
  if (layer.length == 0){
    return "";
  }
  ids = layer[0].id;
  for (var i = 1; i < layer.length; i++){
    ids += ", " + layer[i].id;
  }
  return ids;
}
function displayLayers(layers){
  str = "";
  for (var i = 0; i < layers.length; i++){
    str += "<p>"+flatLayer(layers[i])+"<button onclick = 'setStart("+i+");'>Start</button><button onclick = 'setEnd("+i+");' >End</button><button onclick = 'deleteLayer("+i+");' >Delete</button></p>"
  }
  return str;
}

function groupNodes(layer){
  var newLayer = layer.slice();
  var layer_index = layers.length;
  for (var i = 0; i < newLayer.length; i++){
    newLayer[i]['node_index']= i;
    newLayer[i]['layer_index']= layer_index;
  }
  layers.push(newLayer);
  document.getElementById('view_select').innerHTML = '';
  d3.selectAll('circle').style('stroke', function(d) {
            return d3.rgb(colors(d.id)).darker().toString();})
  document.getElementById('view_layers').innerHTML = displayLayers(layers);
  //document.getElementById('view_layers').innerHTML = JSON.stringify(layers, null, 1);
}

var startLayer = [], endLayer = [];
var start_index = 0;
var layer_pairs = {};
function deleteLayer(index){
  layers.splice(index, 1);
  for (var i = index+1; i < layers.length; i++){
    for (var j = 0; j < layers[i].length; j++){
        layers[i][j]['layer_index']--;
    }
  }
  document.getElementById('view_layers').innerHTML = displayLayers(layers);
}
function setStart(index){
  if (index in layer_pairs){
    alert("Invalid start layer! ");
    return;
  }
  startLayer = layers[index];
  start_index = index;
}
function setEnd(index){
  for (var start in layer_pairs){
    if (layer_pairs[start] == index){
        alert("Invalid end layer! ");
        return;
    }
  }
  endLayer = layers[index];
  FullyConnect(startLayer, endLayer);
  layer_pairs[start_index] = index;
}

var sequence = [];
function isValidNetwork(){
    if (layer_pairs.length == 0){
        return false;
    }
    var keys = [];
    for (var start in layer_pairs){
        keys.push(start);
    }
    start_layers = [];
    for (var i = 0; i < keys.length; i++){
        var start = keys[i];
        has_in = false;
        for (var key in layer_pairs){
            if (layer_pairs[key] == start){
                has_in = true;
                break;
            }
        }
        if (!has_in){
            start_layers.push(start);
        }
    }
    if (start_layers.length != 1){
        return false;
    }
    var first = start_layers[0], cur_start = first;
    sequence.push(first);
    while (cur_start in layer_pairs){
        cur_start = layer_pairs[cur_start];
        sequence.push(cur_start);
    }
    return sequence.length == layers.length;
//    if (sequence.length != layers.length){
//        return false;
//    }else{
//        return true;
//    }
}

function reindex(sequence, layers){
    for (var index = 0; index < sequence.length; index++){
        cur_index = sequence[index];
        for (var j = 0; j < layers[cur_index].length; j++){
            layers[cur_index][j]['layer_index'] = index;
        }
        params.push(layers[cur_index].length);
    }
}
//==========================
// init D3 force layout
//==========================
var force = d3.layout.force()
    .nodes(nodes)
    .links([])
    .size([width, height])
    // .linkDistance(function(d){
		//  var deltaX = d.target.x - d.source.x,
    //     	deltaY = d.target.y - d.source.y;
    //     return Math.sqrt(deltaX * deltaX + deltaY * deltaY);})
	  .gravity(0)
    .charge(0)
    .on('tick', tick)  // 'tick': how's updating every step

//==========================
// define arrow markers for graph links
//==========================
svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)  // markers postion at line
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#000');

svg.append('svg:defs').append('svg:marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 4)
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M10,-5L0,0L10,5')
    .attr('fill', '#000');

//==========================
// line displayed when dragging new nodes
//==========================
var drag_line = svg.append('svg:path')
  .attr('class', 'link dragline hidden')
  .attr('d', 'M0,0L0,0');

// handles to link and node element groups
var path = svg.append('svg:g').selectAll('path'),
    circle = svg.append('svg:g').selectAll('g');

// mouse event vars
var selected_node = null,
    selected_link = null,
    mousedown_link = null,
    mousedown_node = null,
    mouseup_node = null;

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

var callbacks = [];

// update force layout (called automatically each iteration)
function tick() {
  // draw directed edges with proper padding from node centers
  path.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = d.left ? 17 : 12,
        targetPadding = d.right ? 17 : 12,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  circle.attr('transform', function(d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });

}

// update graph (called when needed)
function restart() {
  // path (link) group
  path = path.data(links);

  // update existing links
  path.classed('selected', function(d) { return d === selected_link; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; });


  // add new links
  path.enter().append('svg:path')
    .attr('class', 'link')
    .classed('selected', function(d) { return d === selected_link; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; })
    .style('opacity', function(d){return d.opacity == 1 ? 1 : 0.5; })
    .on('mousedown', function(d) {
      if(d3.event.ctrlKey || d3.event.shiftKey) return;
      // select link
      mousedown_link = d;
      selected_link = (mousedown_link === selected_link)? null: mousedown_link;
      selected_node = null;
      restart();
    });

  // remove old links
  path.exit().remove();

  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, function(d) { return d.id; });

 // update existing nodes (reflexive & selected visual states)
  circle.selectAll('circle')
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id); })
    .classed('reflexive', function(d) { return d.reflexive; });

  // add new nodes
  var g = circle.enter().append('svg:g');
  g.append('svg:circle')
    .attr('class', 'node')
    .attr('r', 12)
    .attr('selected', false)
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id); })
    .style('stroke', function(d) {
      return (d.selected)? 'red': d3.rgb(colors(d.id)).darker().toString();
    })
    .classed('reflexive', function(d) { return d.reflexive; })
    .on('click', function(d) {
    //  if(!mousedown_node || d === mousedown_node) return;
      // enlarge target node
   //    d3.select(this).attr('transform', 'scale(1.1)');
      if(!d3.event.altKey) return;

      var tooltip  = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('padding','0 10px')
          .style('background','white')
          .style('opacity', 9);

      d3.selectAll('circle').style('opacity', .2);
      d3.select(this).style('opacity', 1);
      d3.select(this).style('r', 15);

      for(var i = 0; i< links.length; i++){
          if(links[i].target.id != d.id){
            links[i].opacity = 0;
          }
      }

      path = path.data(links);
      path.style('opacity', function(l){return l.opacity == 1 ? 1 : 0.2; });
      var content = "id: " + d.id + "\n" + "px: " + d.x + "\n" + "py: " + d.y;

      tooltip.html(content)
             .style('left', (d3.event.pageX) + 'px')
             .style('top', (d3.event.pageY) + 'px');

    })
    .on('mouseout', function(d) {
    //  if(!mousedown_node || d === mousedown_node) return;
      // unenlarge target node
    //  d3.select(this).attr('transform', '');
        d3.selectAll('circle').style('opacity', 1);

    //  tooltip.transition().style('opacity', 0);
        d3.select('div.tooltip').remove();

        for(var i = 0; i< links.length; i++){
          links[i].opacity = 1;
        }

        path = path.data(links);
        path.style('opacity', function(l){return l.opacity == 1 ? 1 : 0.2; });
        d3.select(this).style('r', 12);
    })
    .on('mousedown', function(d) {
      if(d3.event.ctrlKey) return;

      if (d3.event.shiftKey) return;

      // select node
      mousedown_node = d;


      if(mousedown_node === selected_node){
        selected_node = null;
      }else{
        selected_node = mousedown_node;
        //document.getElementById('view_select').innerHTML = JSON.stringify(selected_node, null, 1);
      }
      selected_link = null;

      // reposition drag line
      drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

      restart();
    })
    .on('mouseup', function(d) {
      if(!mousedown_node) return;

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if(mouseup_node === mousedown_node) { resetMouseVars(); return; }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans
      var source, target, direction;
      if(mousedown_node.id < mouseup_node.id) {
        source = mousedown_node;
        target = mouseup_node;
        direction = 'right';
      } else {
        source = mouseup_node;
        target = mousedown_node;
        direction = 'left';
      }

      var link;
      link = links.filter(function(l) {
        return (l.source === source && l.target === target);
      })[0];

      if(link) {
        link[direction] = true;
      } else {
        link = {source: source, target: target, left: false, right: false, opacity:1};
        link[direction] = true;
        links.push(link);
      }

      // select new link
      selected_link = link;
      selected_node = null;
      restart();
    });

  // show node IDs
  g.append('svg:text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('class', 'id')
      .text(function(d) { return d.id; });

  // remove old nodes
  circle.exit().remove();

  // output graph structs
  //document.getElementById('view_json').innerHTML = JSON.stringify({neurons:nodes, connects:links}, null, 1);
  // set the graph in motion
  force.start();
}

function mousedown() {

  // prevent I-bar on drag
  d3.event.preventDefault();

  // because :active only works in WebKit?
  svg.classed('active', true);

  if(d3.event.ctrlKey || d3.event.shiftKey  || mousedown_node || mousedown_link) return;

  // insert new node at point
  var point = d3.mouse(this),
	  node = {id: ++lastNodeId, reflexive: false};

  node.x = point[0];
  node.y = point[1];
  node.layer = -1;
  node.sequenceid = -1;

  // avoid overlap nodes
  for(var i = 0; i< nodes.length; i++){

      var temp = nodes[i];
      var distx = node.x - temp.x;
      var disty = node.y - temp.y;

      var d = Math.sqrt(distx*distx + disty*disty);

      if(d < 24){
        lastNodeId --;

        return;
      }

  }

  nodes.push(node);
  restart();


}

function mousemove() {
  if(!mousedown_node) return;

  // update drag line
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

  restart();
}

function mouseup() {
  if(mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function spliceLinksForNode(node) {
  var toSplice = links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
}

// only respond once per keydown
var lastKeyDown = -1;

function keydown() {
  if (currentObject != null){
    return;
  }
  d3.event.preventDefault();

  if(lastKeyDown !== -1) return;
  lastKeyDown = d3.event.keyCode;

  // ctrl
  if(d3.event.keyCode === 17) {
    circle.call(force.drag);
    svg.classed('ctrl', true);

  }

  //alert
  if(d3.event.keyCode === 18){
    svg.classed('alt', true);
  }

  if (d3.event.shiftKey){
    svg.classed('shift', true);
    d3.select('svg').select('.background').style('cursor', 'crosshair');
    brush.call(brusher);
  }

  if(!selected_node && !selected_link) return;
  switch(d3.event.keyCode) {
    case 8: // backspace
    case 46: // delete
      if(selected_node) {
        nodes.splice(nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      } else if(selected_link) {
        links.splice(links.indexOf(selected_link), 1);
      }
      selected_link = null;
      selected_node = null;
      restart();
      break;
    case 66: // B
      if(selected_link) {
        // set link direction to both left and right
        selected_link.left = true;
        selected_link.right = true;
      }
      restart();
      break;
    case 76: // L
      if(selected_link) {
        // set link direction to left only
        selected_link.left = true;
        selected_link.right = false;
      }
      restart();
      break;
    case 82: // R
      if(selected_node) {
        // toggle node reflexivity
        selected_node.reflexive = !selected_node.reflexive;
      } else if(selected_link) {
        // set link direction to right only
        selected_link.left = false;
        selected_link.right = true;
      }
      restart();
      break;
  }
}

function keyup() {
  if (currentObject != null){
    return;
  }
  lastKeyDown = -1;
  // ctrl
  if(d3.event.keyCode === 17) {
    circle
      .on('mousedown.drag', null)
      .on('touchstart.drag', null);
    svg.classed('ctrl', false);
  }
  //alt
  if(d3.event.keyCode === 18) {

    svg.classed('alt', false);
  }

  // shift
  else if (d3.event.keyCode === 16){
    svg.classed('shift', false);
    brush.select('.background').style('cursor', 'default');
    shiftKey = false;
  }
  brush.call(brusher)
    .on("mouseup.brush", null)
    .on('mousemove.brush', null)
    .on('drag.brush', null)
    .on("mousedown.brush", null);
}


function generateLayers(){
  nodes = [];
  links = [];
  cur_layer = [];
  layers = [];
  lastNodeId = 0;
  content = document.getElementById('gen_layers').value;
  if ( content.length < 2 || (!(content.startsWith('[') && content.endsWith(']')))){
    alert("invalid input!");
    return;
  }
  content = content.substring(1, content.length-1);
  var temp = content.split(',')
  
  
  
  var x0 = 0;
  var stepx = width * 4 / 7 / (temp.length+2);
  for (i = 0; i < temp.length; i++){
    var y0 = 0;
    cur_layer = [];
    len = parseInt(temp[i]);
    
    stepy = height / (len+2);
    for (j = 0; j < len; j++){
      //node = {id: ++lastNodeId, reflexive: false};
      node = {id: ++lastNodeId, reflexive: false, x:x0+stepx, y:y0+stepy, layer : i, sequenceid: j};
      nodes.push(node);
      cur_layer.push(node);
      
      y0 = y0+stepy;
       
    }
    x0 = x0+stepx;
    layers.push(cur_layer.slice());
    if (i > 0){
      FullyConnect(layers[i-1], layers[i]);
      layer_pairs[i-1] = i;
    }
  }
}

function viz_network(temp){
  nodes = [];
  cur_layer = [];
  layers = [];
  lastNodeId = 0;

  for (i = 0; i < temp.length; i++){
    cur_layer = [];
    len = parseInt(temp[i]);
    for (j = 0; j < len; j++){
      //node = {id: ++lastNodeId, reflexive: false};
      node = {id: ++lastNodeId, reflexive: false, x:100+i*100, y:70+j*50, node_index: j, layer_index: i, opacity:1};
      nodes.push(node);
      cur_layer.push(node);
    }
    layers.push(cur_layer.slice());
    if (i > 0){
      FullyConnect(layers[i-1], layers[i]);
      layer_pairs[i-1] = i;
    }
  }
}

//var layers_links = [];

function createLinks(layer_source, layer_target){

   for(var i = 0; i < layer_source.length; i++){

        var s = layer_source[i];

        for(var j = 0; j<layer_target.length; j++){

            var t = layer_target[j];
            links.push({
              source : s,
              target : t,
              left : false,
              right : true,
              opacity:1
            });
        }
   }
}


var connect = 0;


function FullyConnect(layerfrom, layerto) {

  createLinks(layerfrom, layerto);
  restart();


//  var connection = svg.append('svg:g').selectAll('path'),
//  connection = connection.data(layers_links);

  if(connect === 1){
      connect = 0;
      path.attr('d', '');
      return;
  }

  path.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = d.left ? 17 : 12,
        targetPadding = d.right ? 17 : 12,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });


  connect = 1;

}
function validateNetwork(){
    if (isValidNetwork()){
        alert("Valid!");

    }else{
        alert("Invalid!");
    }
    sequence =[];
}
function saveModel(){
    if (!isValidNetwork()){
        alert("Invalid network! ");
        return;
    }else{
        reindex(sequence, layers);
    }
//    json_str = "{\"nodes\":" + JSON.stringify(nodes) + ", \"linkes\":"+JSON.stringify(links)+"}";
//    obj = JSON.parse(json_str);
//    document.getElementById("view_json").innerHTML = JSON.stringify(obj);
    document.getElementById("view_json").innerHTML = flatParams();
    // to do...
}
function flatParams(){
    var str = ""
    for (var i = 0; i < params.length; i++){
        str += params[i] + ","
    }
    return str.substring(0, str.length - 1);
}
// app starts here
svg.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);

//d3.select("#draw")
 d3.select('body')
  .on('keydown', keydown)
  .on('keyup', keyup);
restart();

//input_ids = ['#gen_layers', '#learning_rate', '#num_iters', '#out_dim']


d3.select('#gen_layers')
        .on("mouseover", function() {
            currentObject = this;
            d3.event.stopPropagation();
        })
        .on("mouseout", function() {
            currentObject = null;
            d3.event.stopPropagation();
        });

d3.select('#learning_rate')
        .on("mouseover", function() {
            currentObject = this;
            d3.event.stopPropagation();
        })
        .on("mouseout", function() {
            currentObject = null;
            d3.event.stopPropagation();
        });
d3.select('#num_iters')
        .on("mouseover", function() {
            currentObject = this;
            d3.event.stopPropagation();
        })
        .on("mouseout", function() {
            currentObject = null;
            d3.event.stopPropagation();
        });
d3.select('#out_dim')
        .on("mouseover", function() {
            currentObject = this;
            d3.event.stopPropagation();
        })
        .on("mouseout", function() {
            currentObject = null;
            d3.event.stopPropagation();
        });
