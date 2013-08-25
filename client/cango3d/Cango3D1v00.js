/*==============================================================
  Filename: Cango3D1v00.js
  Rev: 1
  By: A.R.Collins
  Description: A basic 3D graphics interface for the canvas
  element.
  License: Released into the public domain latest version at
  <http://www/arc.id.au/>
  Requires:
  - IE canvas emulator 'excanvas-modified.js' from
  - cvs3DLib.js
  SVG parser is based on code from cake.js
  <http://code.google.com/p/cakejs/>.
  Modified to handle the SVG shortcuts which omit repeated
  or unambiguous command specifiers.

  Date   |Description                                      |By
  --------------------------------------------------------------
  21Oct12 First release,
          Rewite of cvs3DGraphCtx3v01 based on Cango ideas  ARC
  ==============================================================*/

  var _resized = new Array();   // keep track of which canvases are initialised

  var shapeDefs = {'circle':['M', -0.5, 0, 'a', 0.5, 0.5, 0, 1, 1, 1, 0, 0.5, 0.5, 0, 1, 1, -1, 0],
                   'square':['M', -0.5, -0.5, 'l', 0, 1, 1, 0, 0, -1, 'z'],
                   'triangle':['M', -0.5, -0.289, 'l', 0.5, 0.866, 0.5, -0.866, 'z']};

  function Cango3D(canvasId)
  {
    this.cId = canvasId;
    this.cnvs = document.getElementById(canvasId);
    this.rawWidth = this.cnvs.offsetWidth;
    this.rawHeight = this.cnvs.offsetHeight;
    this.aRatio = this.rawWidth/this.rawHeight;

    if (!(this.cId in _resized))
    {
    /* make canvas native aspect ratio equal style box aspect ratio.
       only do this once for each canvas as it clears the canvas.
       A second graph to be drawn will erase the firt graph if the canvas
       width and height attributes are reset */
      /* Note: rawWidth and rawHeight are floats, assignment to ints will truncate */
        this.cnvs.setAttribute('width', this.rawWidth);     // this actually reset the number of graphics pixels
        this.cnvs.setAttribute('height', this.rawHeight);   // use this instead of style to match emulator

      /* create an element in associative array for this canvas
         element's existance is the test that resize has been done.
         Could have used the existance of the busy flag but lets use
         separate code for separate function */
      _resized[this.cId]= true;
    }

    this.ctx = this.cnvs.getContext('2d');
    this.ctx.save();

    this.vpW = this.rawWidth;         // vp width in pixels (default to full canvas size)
    this.vpH = this.rawHeight;        // vp height in pixels
    this.vpLLx = 0;                   // vp lower left from canvas left in pixels
    this.vpLLy = this.rawHeight;      // vp lower left from canvas top
    this.xscl = this.rawWidth/100;    // world x axis scale factor, default canvas width = 100 native units
    this.yscl = -this.rawWidth/100;   // world y axis scale factor, default +ve up and canavs height =100*aspect ratio (square pixels)
    this.xoffset = 0;                 // world x origin offset from viewport left in pixels
    this.yoffset = 0;                 // world y origin offset from viewport bottom in pixels
                                      // *** to move to world coord x ***
                                      // 1. from pixel x origin (canvas left) add vpLLx (gets to viewport left)
                                      // 2. add xoffset to get to pixel location of world x origin
                                      // 3. add x*xscl pixels to get to world x location.
                                      // ==> x (in world coords) == vpLLx + xoffset + x*xscl (pixels location of canvas)
                                      // ==> y (in world coords) == vpLLy + yoffset + y*xscl (pixels location of canvas)

    this.penCol = "rgba(0, 0, 0, 1.0)";        // black
    this.penWid = 1;             // pixels
    this.paintCol = "rgba(255, 255, 255, 1.0)";  // white
    this.fontSize = 10;          // 10pt

    this.viewpointDistance = 500;
    this.lightSource = {x:0, y:0, z:-500};
    this.objType = {PATH:0, SHAPE:1, TEXT:2};   // access by 'this.objType.XXXX'
  }

  // copy the basic graphics context values (for an overlay)
  Cango3D.prototype.dupCtx = function(src_graphCtx)
  {
    // copy all the graphics context parameters into the overlay ctx.
    this.rawWidth = src_graphCtx.rawWidth;
    this.rawHeight = src_graphCtx.rawHeight;
    this.aRatio = src_graphCtx.aRatio;
    this.vpW = src_graphCtx.vpW;          // vp width in pixels (default to full canvas size)
    this.vpH = src_graphCtx.vpH;          // vp height in pixels
    this.vpLLx = src_graphCtx.vpLLx;      // vp lower left from canvas left in pixels
    this.vpLLy = src_graphCtx.vpLLy;      // vp lower left from canvas top
    this.xscl = src_graphCtx.xscl;        // world x axis scale factor
    this.yscl = src_graphCtx.yscl;        // world y axis scale factor
    this.xoffset = src_graphCtx.xoffset;  // world x origin offset from viewport left in pixels
    this.yoffset = src_graphCtx.yoffset;  // world y origin offset from viewport bottom in pixels
    this.penCol = src_graphCtx.penCol.slice(0);
    this.penWid = src_graphCtx.penWid;    // pixels
    this.paintCol = src_graphCtx.paintCol.slice(0);
    this.lineCap = "butt";
    this.fontSize = src_graphCtx.fontSize;
    this.viewpointDistance = src_graphCtx.viewpointDistance;
    this.lightSource.x = src_graphCtx.lightSource.x;
    this.lightSource.y = src_graphCtx.lightSource.y;
    this.lightSource.z = src_graphCtx.lightSource.z;

    this._setCtx();
  }

  Cango3D.prototype.resetCtx = function()
  {
    // reset the drawing defualts in case they have been set by assignment rather than setPenColor() etc
    this.ctx.strokeStyle = this.penCol;
    this.ctx.fillStyle = this.paintCol;
    this.ctx.lineWidth = this.penWid;
    this.ctx.lineCap = this.lineCap;
  }

  Cango3D.prototype.clearCanvas = function(fillColor)
  {
    /* clearCanvas() sets the background color and fills the canvas to that color */
    if (typeof fillColor != 'undefined')
    {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(0, 0, this.rawWidth, this.rawHeight);
    }
    else
    {
      this.ctx.clearRect(0, 0, this.rawWidth, this.rawHeight);
      // all drawing erased
      // but all global graphics contexts remain intact
    }
  }

  Cango3D.prototype.setWorldCoords3D = function(leftX, lowerY, spanX)
  {
    if (spanX >0)
    {
      this.xscl = this.vpW/spanX;
      this.yscl = -this.xscl;
      this.xoffset = -leftX*this.xscl;
      this.yoffset = -lowerY*this.yscl;
    }
    else
    {
      this.xscl = this.rawWidth/100;    // makes xaxis = 100 native units
      this.yscl = -this.rawWidth/100;   // makes yaxis = 100*aspect ratio ie. square pixels
      this.xoffset = 0;
      this.yoffset = 0;
    }
  }

  Cango3D.prototype.setPenColor = function(color)
  {
    if (typeof color != "undefined")
      this.penCol = color;

    this.ctx.strokeStyle = this.penCol;
  }

  Cango3D.prototype.setPaintColor = function(color)
  {
    if (typeof color != 'undefined')
     this.paintCol = color;
 
    this.ctx.fillStyle = this.paintCol;
  }

  Cango3D.prototype.setPenWidth = function(w)    // w in screen px
  {
    if (typeof w != "undefined")
      this.penWid = w;

    this.ctx.lineWidth = this.penWid;
  }

  Cango3D.prototype.setLineCap = function(c)    // c = 'butt', 'round' or 'square'
  {
    if (typeof c == "undefined")
      this.lineCap = "butt";
    else if ((c == "butt")||(c =="round")||(c == "square"))
      this.lineCap = c;

    this.ctx.lineCap = this.lineCap;
  }

  Cango3D.prototype.setFontSize = function(s)    // s in points
  {
    if (typeof s != "undefined")
      this.fontSize = s;
  }

  Cango3D.prototype.setViewpointDistance = function(d)    // d in world coords
  {
    if (d > 0)
      this.viewpointDistance = d;
  }

  Cango3D.prototype.setLightSource = function(x, y, z)    // x, y, z in world coords
  {
    if ((x != undefined)&&(y != undefined)&&(z != undefined))
    {
      this.lightSource.x = x;
      this.lightSource.y = y;
      this.lightSource.z = z;
    }
  }

  Cango3D.prototype.compilePath3D = function(path, color, scl)
  {
    // this is a preprocessor to convert an array of \\
    // svg Path syntax letters and numbers into 'segs' format
    if (!(path instanceof Array))
      return;

    var segs = [];
    var i, j;

    for(j=0, i=1; i<path.length; i++)
    {
      if (typeof path[i] == 'string')
      {
        segs.push(path.slice(j,i));
        j = i;
      }
    }
    segs.push(path.slice(j,i));    // push the last command out

    // now send these off to the svg segs to canvas DrawCmd processor

    var scale = 1;
    if ((typeof scl != "undefined")&&(scl>0))
    {
      scale *= scl;
    }
    var xOfs = 0;
    var yOfs = 0;

    var commands = this.segsToDrawCmds3D(segs, xOfs, yOfs, scale, scale);

    var path3D = new Obj3D(this, commands, this.objType.PATH, color);
 
    return path3D;   // object of type Obj3D
  }
  
  Cango3D.prototype.compileShape3D = function(path, fillColor, scl)
  {
    // this is a preprocessor to convert an array of svg Path syntax letters and numbers into 'segs' format
    // segs = [ ['M', c, c], ['L', c, c, c, c ..], [], []... ];
    // which are then compiled to canvas drawCmd objects ready to render
    if (!(path instanceof Array))
      return;

    var segs = [];
    var i, j;
    for(j=0, i=1; i<path.length; i++)
    {
      if (typeof path[i] == 'string')
      {
        segs.push(path.slice(j,i));
        j = i;
      }
    }
    segs.push(path.slice(j,i));    // push the last command out
    // now send these off to the svg segs-to-canvas DrawCmd processor
    var scale = 1;
    if ((typeof scl != "undefined")&&(scl>0))
    {
      scale *= scl;
    }
    var xOfs = 0;                 // move the shape reference point
    var yOfs = 0;

    var commands = this.segsToDrawCmds3D(segs, xOfs, yOfs, scale, scale);

    var path3D = new Obj3D(this, commands, this.objType.SHAPE, fillColor);
 
    return path3D;   // object of type Obj3D
  }
 
  Cango3D.prototype.compileSvgPath3D = function(svgPath, color, xRef, yRef)
  {
    if (typeof svgPath != 'string')
      return;
    // this is a preprocessor to get an svg Path string into 'Obj2D' format
    var segs = [];
    var cmd, seg, cmdLetters, coords;
    var strs = svgPath.split(/(?=[a-df-z])/i);  // avoid e in exponents
    // now array of strings with command letter start to each

    for (var i=0; i<strs.length; i++)
    {
      seg = strs[i];
      // get command letter into an array
      cmdLetters = seg.match(/[a-z]/i);
      if (!cmdLetters)
        return [];
      cmd = cmdLetters.slice(0,1);
      if ((i==0)&&(cmd[0] != 'M'))   // check that the first move is absolute
        cmd[0] = 'M';
      coords = seg.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/gi);
      if (coords)
        coords = coords.map(parseFloat);
      segs.push(cmd.concat(coords));
    }
    // now send these off to the svg segs to canvas DrawCmd processor

    var xScale = 1;
    var yScale = -1;                        // flip all the y coords to +ve up
    var xOfs = xRef || 0;                 // move the path reference point
    var yOfs = -yRef || 0;

    var commands = this.segsToDrawCmds3D(segs, xOfs, yOfs, xScale, yScale);
    
    var path3D = new Obj3D(this, commands, this.objType.PATH, color);
 
    return path3D;   // object of type Obj3D
  }

  Cango3D.prototype.compileSvgShape3D = function(svgPath, fillColor, xRef, yRef)
  {
    if (typeof svgPath != 'string')
      return;
    // this is a preprocessor to get an svg Path string into 'Obj2D' format
    var segs = [];
    var cmd, seg, cmdLetters, coords;
    var strs = svgPath.split(/(?=[a-df-z])/i);  // avoid e in exponents
    // now array of strings with command letter start to each

    for (var i=0; i<strs.length; i++)
    {
      seg = strs[i];
      // get command letter into an array
      cmdLetters = seg.match(/[a-z]/i);
      if (!cmdLetters)
        return [];
      cmd = cmdLetters.slice(0,1);
      if ((i==0)&&(cmd[0] != 'M'))   // check that the first move is absolute
        cmd[0] = 'M';
      coords = seg.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/gi);
      if (coords)
        coords = coords.map(parseFloat);
      segs.push(cmd.concat(coords));
    }
    // now send these off to the svg segs to canvas DrawCmd processor

    var xScale = 1;
    var yScale = -1;                        // flip all the y coords to +ve up
    var xOfs = xRef || 0;                 // move the path reference point
    var yOfs = -yRef || 0;

    var commands = this.segsToDrawCmds3D(segs, xOfs, yOfs, xScale, yScale);
    
    var path3D = new Obj3D(this, commands, this.objType.SHAPE, fillColor);
 
    return path3D;   // object of type Obj3D
  }

  Cango3D.prototype.labelShape3D = function(obj, str, x, y, ptSize, lorigin, color)
  {
    if ((typeof str != 'string')||!(str.length)||(obj.type != this.objType.SHAPE))
      return null;

    var lorg = lorigin || 1;
    var size = ptSize || this.fontSize;
    var lineWidth = 0.08*size;    // =2*size/25 (see CanvasTextFuctions.draw)
    size /= this.xscl;    // independent of world coord scaling, set size by point size
    var mag = size/25;    // size/25 is worlds coords scaled to stored font size

    var cmdObj;
    var commands = [];
    var cPts = [];
    var ep;
    var xLofs = 0;
    var yLofs = 0;  /* label origin offsets */

    var strWidth = CanvasTextFunctions.measure(0, size, str);
    var strHeight = 0.84*size;
    /* Note: char cell is 33 pixels high, char size is 21 pixels (0 to 21), decenders go to -7 to 21.
       passing 'size' to text function scales char height by size/25.
       So reference height for vertically alignment is charHeight = 21/25 (=0.84) of the fontSize. */
    switch (lorg)
    {
      case 1:
      default:
        xLofs = 0;
        yLofs = strHeight;
        break;
      case 2:
        xLofs = 0.5*strWidth;
        yLofs = strHeight;
        break;
      case 3:
        xLofs = strWidth;
        yLofs = strHeight;
        break;
      case 4:
        xLofs = 0;
        yLofs = 0.5*strHeight;
        break;
      case 5:
        xLofs = 0.5*strWidth;
        yLofs = 0.5*strHeight;
        break;
      case 6:
        xLofs = strWidth;
        yLofs = 0.5*strHeight;
        break;
      case 7:
        xLofs = 0;
        yLofs = 0;
        break;
      case 8:
        xLofs = 0.5*strWidth;
        yLofs = 0;
        break;
      case 9:
        xLofs = strWidth;
        yLofs = 0;
        break;
    }

    var dx = x-xLofs;
    var dy = y-yLofs;
    
    for (var i = 0; i < str.length; i++)
    {
      var c = CanvasTextFunctions.letter(str.charAt(i));
      if (!c)
        continue;

      var penUp = 1;

      for (var j = 0; j < c.points.length; j++)
      {
        var a = c.points[j];
        if ((a[0] == -1) && (a[1] == -1))
        {
          penUp = 1;
          continue;
        }
        if (penUp == 1)
        {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          penUp = 0;
        } else {
          cPts = [];
          ep = new Point(dx + a[0]*mag, dy + a[1]*mag, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
          commands.push(cmdObj);
        }
      }
      dx += c.width*mag;
    }

    obj.textCmds = obj.textCmds.concat(commands);  // multiple labels may be added 
    if (typeof color != 'undefined')
      obj.strokeColor = color;
    else
      obj.strokeColor = this.penCol;
    obj.strokeWidth = lineWidth;    // normal weight stroke width is saved
  }

  /* 3D projection with perspective  */
  Cango3D.prototype.project3D = function(point)
  {
    // projection is onto screen at z = 0 viewpointDistance (NOT A coordinate)
    var r = -Math.abs(this.viewpointDistance);

    // perspective projection
    point.fx = point.tx * r/(r - point.tz);
    point.fy = point.ty * r/(r - point.tz);
  }

  Cango3D.prototype._obj3Dto2D = function(obj, xfrm, plotNormals)
  {
    obj.drawData = [];   // clear the drawlist
    softTransformPoint(obj.origin, xfrm);                  // translate, rotate the origin of the Obj3D
    this.project3D(obj.origin);                        // apply perspective to origin
    softTransformPoint(obj.normal, xfrm);                  // translate, rotate the normal of the Obj3D
    this.project3D(obj.normal);                        // apply perspective to normal

    // make the 2D drawData parameters for each drawCmd
    for(j=0; j<obj.drawCmds.length; j++)   // step through the draw segments
    {
      obj.drawData[j] = new DrawCmd(obj.drawCmds[j].drawFn);   // this is a 2D drawCmd
      for (k=0; k<obj.drawCmds[j].cPts.length; k++)   // extract flattened 2D coords from 3D Points
      {
        softTransformPoint(obj.drawCmds[j].cPts[k], xfrm);
        this.project3D(obj.drawCmds[j].cPts[k]);             // apply perspective to nodes
        obj.drawData[j].parms[2*k] = obj.drawCmds[j].cPts[k].fx;
        obj.drawData[j].parms[2*k+1] = obj.drawCmds[j].cPts[k].fy;
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (obj.drawCmds[j].ep != undefined)
      {
        softTransformPoint(obj.drawCmds[j].ep, xfrm);              // rotate, translate end point in space
        this.project3D(obj.drawCmds[j].ep);                    // apply perspective to end point
        obj.drawData[j].parms[2*k] = obj.drawCmds[j].ep.fx;
        obj.drawData[j].parms[2*k+1] = obj.drawCmds[j].ep.fy;
      }
    }

    if (obj.textCmds.length>0)  // text has been added to this Obj3D
    {
      // make the 2D textData parameters for each textCmd
      for(j=0; j<obj.textCmds.length; j++)   // step through the draw segments
      {
        obj.textData[j] = new DrawCmd(obj.textCmds[j].drawFn);   // this is a 2D drawCmd
        for (k=0; k<obj.textCmds[j].cPts.length; k++)   // extract flattened 2D coords from 3D Points
        {
          softTransformPoint(obj.textCmds[j].cPts[k], xfrm);
          this.project3D(obj.textCmds[j].cPts[k]);             // apply perspective to nodes
          obj.textData[j].parms[2*k] = obj.textCmds[j].cPts[k].fx;
          obj.textData[j].parms[2*k+1] = obj.textCmds[j].cPts[k].fy;
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (obj.textCmds[j].ep != undefined)
        {
          softTransformPoint(obj.textCmds[j].ep, xfrm);
          this.project3D(obj.textCmds[j].ep);                  // apply perspective to end point
          obj.textData[j].parms[2*k] = obj.textCmds[j].ep.fx;
          obj.textData[j].parms[2*k+1] = obj.textCmds[j].ep.fy;
        }
      }
    }
    // the object's drawData and textData arrays now hold the 2D projection ready to be drawn
  }

  Cango3D.prototype.render3D = function(obj, xfm, plotNormals)  // Obj3D, Transform3D, boolean
  {
    var i;

    if ((typeof xfm == 'undefined') || (xfm == null))
      xfm = new Transform3D();                // returns an object with indentityMatrix

    if (obj instanceof Array)      // rendering an array of objects
    {
      // do all the 3D transforms and projections
      for (i=0; i < obj.length; i++)
        this._obj3Dto2D(obj[i], xfm.matrix);
      // Depth sorting (painters algorithm, draw from the back to front)
      obj.sort(function (p1, p2)
                {
                  return p2.origin.tz - p1.origin.tz;
                });
      // now render them onto the canvas
      for (i=0; i < obj.length; i++)
        this._paintObj3D(obj[i], plotNormals);
    }
    else
    {
      this._obj3Dto2D(obj, xfm.matrix);
      this._paintObj3D(obj, plotNormals);
    }
  }

/*========================================================
 * _paintObj3D takes an Obj3D which has been transformed
 * and projected to 2D all the canvas commands are
 * formatted but in world coordinates.
 * Convert to canvas pixels and draw them onto the canvas
 *-------------------------------------------------------*/
  Cango3D.prototype._paintObj3D = function(pg, plotNormals)
  {
    var j, k;

    this.ctx.save();   // save the current ctx we are going to change bits
    this.ctx.beginPath();
    // step through the Obj3D drawData array of commands and draw each one
    for (j=0; j < pg.drawData.length; j++)
    {
      // convert all parms to world coords
      for (k=0; k<pg.drawData[j].parms.length; k+=2)   // step thru the coords in x,y pairs
      {
        pg.drawData[j].parms[k] = this.vpLLx+this.xoffset+pg.drawData[j].parms[k]*this.xscl;
        pg.drawData[j].parms[k+1] = this.vpLLy+this.yoffset+pg.drawData[j].parms[k+1]*this.yscl;
      }
      // now actually draw the path onto the canvas
      this.ctx[pg.drawData[j].drawFn].apply(this.ctx, pg.drawData[j].parms);
    }
    // fill and stroke the path
    if (pg.type == this.objType.SHAPE)
    {
      this.ctx.closePath();
      this.ctx.fillStyle = this.calcShapeShade(pg);
      this.ctx.strokeStyle = this.ctx.fillStyle;
      this.ctx.lineWidth = 1;
      this.ctx.fill();
      this.ctx.stroke();    // stroke outline
    }
    else
    {
      this.ctx.strokeStyle = pg.strokeColor;
      this.ctx.stroke();    // stroke outline
    }

    if (plotNormals)      // draw the normal
    {
      // convert the origin and normal too
      var ox = this.vpLLx+this.xoffset+pg.origin.fx*this.xscl;
      var oy = this.vpLLy+this.yoffset+pg.origin.fy*this.yscl;
      var nx = this.vpLLx+this.xoffset+pg.normal.fx*this.xscl;
      var ny = this.vpLLy+this.yoffset+pg.normal.fy*this.yscl;

      if (pg.origin.tz > pg.normal.tz)  // +ve into screen
        this.ctx.strokeStyle = "green";      // pointing toward viewer
      else
        this.ctx.strokeStyle = "red";      // pointing away from viewer

      this.ctx.beginPath();
      this.ctx.moveTo(ox, oy);
      this.ctx.lineTo(nx, ny);
      this.ctx.stroke();
    }
    
    this.ctx.restore();  // put things back the way they were
    
    // now draw the text character paths if text is toward the viewer
    if ((pg.type == this.objType.SHAPE)&&(pg.textCmds.length>0)&&(pg.origin.tz > pg.normal.tz))
      this._paintText3D(pg);
  }

  Cango3D.prototype._paintText3D = function(pg)
  {
    if ((typeof pg == 'undefined') || (pg == null))
      return;
    // Obj.type == SHAPE can have text label, stroed in separte textCmds array
    var j, k;

    for(j=0; j<pg.textCmds.length; j++)   // step through the draw segments
    {
      pg.textData[j] = new DrawCmd(pg.textCmds[j].drawFn);   // this is a 2D drawCmd
      for (k=0; k<pg.textCmds[j].cPts.length; k++)   // extract flattened 2D coords from 3D Points
      {
        this.project3D(pg.textCmds[j].cPts[k]);  // apply perspective to vertices
        pg.textData[j].parms[2*k] = pg.textCmds[j].cPts[k].fx;
        pg.textData[j].parms[2*k+1] = pg.textCmds[j].cPts[k].fy;
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (pg.textCmds[j].ep != undefined)
      {
        this.project3D(pg.textCmds[j].ep);  // apply perspective to vertices
        pg.textData[j].parms[2*k] = pg.textCmds[j].ep.fx;
        pg.textData[j].parms[2*k+1] = pg.textCmds[j].ep.fy;
      }
    }

    this.ctx.save();   // save the current ctx we are going to change bits
    this.ctx.beginPath();
    // step through the Obj3D textData array of commands and draw each one
    for (j=0; j < pg.textData.length; j++)
    {
      // convert all parms to world coords
      for (k=0; k<pg.textData[j].parms.length; k+=2)   // step thru the coords in x,y pairs
      {
        pg.textData[j].parms[k] = this.vpLLx+this.xoffset+pg.textData[j].parms[k]*this.xscl;
        pg.textData[j].parms[k+1] = this.vpLLy+this.yoffset+pg.textData[j].parms[k+1]*this.yscl;
      }
      // now actually draw the path onto the canvas
      this.ctx[pg.textData[j].drawFn].apply(this.ctx, pg.textData[j].parms);
    }
    // stroke the path
    this.ctx.lineWidth = pg.strokeWidth;
    this.ctx.lineCap = "round";
    this.ctx.strokeStyle = pg.strokeColor;
    this.ctx.stroke();    // stroke outline
    
    this.ctx.restore();  // put things back the way they were
  }

  Cango3D.prototype.calcShapeShade = function(obj)
  {
    // viewpoint is always on -z axis, viewpointDistance from coord system origin
    var los = new Point(0, 0, -this.viewpointDistance);  // store this in the Line Of Sight vector
    var col = new RGBAColor(obj.fillColor);
  
    // luminence is dot product of shape's normal and lightSource vector
    // Shape's normal is '10/xscl' long, make scal factor for lightSource vectro to be 10/xscl
    var sunScl = 10/this.xscl*Math.sqrt(this.lightSource.x*this.lightSource.x + this.lightSource.y*this.lightSource.y + this.lightSource.z*this.lightSource.z);
    var lum = this.lightSource.x*(obj.normal.tx-obj.origin.tx) + this.lightSource.y*(obj.normal.ty-obj.origin.ty) + this.lightSource.z*(obj.normal.tz-obj.origin.tz);
    lum = 0.7*lum/sunScl;     // normalise to range 0..0.7
    lum = Math.abs(lum);     // normal can be up or down (back given same shading)
    lum += 0.3;          // add a base level so its not too dark
  
    /* Now calculate unit vector along line of sight to decide if we are looking at front or back
       if normal dot product with LOS is +ve its the top, -ve its the bottom
       bottom might get a different colour.
       no need to normalise, just need the sign of dot product */
    los.tx = los.x - obj.origin.tx;
    los.ty = los.y - obj.origin.ty;
    los.tz = los.z - obj.origin.tz;
    if ((obj.normal.tx-obj.origin.tx)*los.tx + (obj.normal.ty-obj.origin.ty)*los.ty + (obj.normal.tz-obj.origin.tz)*los.tz < 0)
    {
      //  looking at back
        // make it magenta
      col.r = 200;
      col.g = 0;
      col.b = 200;
      // back will be dark if normal (front) is pointing toward the lightSource
      if ((obj.normal.tx-obj.origin.tx)*this.lightSource.x + (obj.normal.ty-obj.origin.ty)*this.lightSource.y + (obj.normal.tz-obj.origin.tz)*this.lightSource.z > 0)
        lum = 0.3;
    }
    else
    {
      // looking at the front
      // front will be dark if normal is pointing away from lightSource
      if ((obj.normal.tx-obj.origin.tx)*this.lightSource.x + (obj.normal.ty-obj.origin.ty)*this.lightSource.y + (obj.normal.tz-obj.origin.tz)*this.lightSource.z < 0)
        lum = 0.3;
    }
     // calc rgb color based on V5 (component of normal to polygon in direction on POV)
    var cr = Math.round(lum*col.r);
    var cg = Math.round(lum*col.g);
    var cb = Math.round(lum*col.b);
    var ca = col.a;
  
    return "rgba("+cr+","+cg+","+cb+","+ca+")";     // string format 'rgba(r,g,b,a)'
  }

  function Transform3D()
  {
    this.matrix = identityMatrix();  // this return an array
  }

  Transform3D.prototype.rotate = function(xRot, yRot, zRot)
  {
    var t = Math.PI/180.0;

    var rot = genRotateMatrix(xRot*t, yRot*t, zRot*t);
    this.matrix = matrixMultiply(this.matrix, rot);
  }

  // Apply a translation to current transformation matrix
  Transform3D.prototype.translate = function(x, y, z)
  {
    var trns = genTranslateMatrix(x, y, z);
    this.matrix = matrixMultiply(this.matrix, trns);
  }

  // Apply a scale to current transformation matrix
  Transform3D.prototype.scale = function(s)
  {
    var scl = genScaleMatrix(Math.abs(s));
    this.matrix = matrixMultiply(this.matrix, scl);
  }

  /* =======================================================================
   * objectOfRevolution3D
   * The profile decribed by 'path' array of SVG syntax commands will form
   * the profile of an object of revolution. 'path may be and array in Cango
   * coordinates or a string in SVG (y flipped) coordinates.
   * A copy is made of this profile and rotated by the segment angle about
   * the Y axis, the segment end points are joined across back to the
   * original profile by circular arcs top and bottom forming a panel.
   * These panels form one segment of the shape like a segment of an orange.
   * To get fill to work, path sections must traversed in a consistant direction
   * (CW to get the normal pointing out of screen). So the profile copy
   * must be tranversd backwards. This is OK as only Cubic Beziers and straight
   * lines are used in this library.
   * Parameters:
   * path: An array of SVG format 2D commands defining the shape's profile
   * radius: distance from start of profile to the center of rotation
   * totalAngle: 360 degrees for full rotation or less
   * segments: number of segments into which totalAngle is divided
   * fillColor: HTML format color string
   * return: the array of Obj3Ds that will draw the 3D shape.
   * -----------------------------------------------------------------------*/
  Cango3D.prototype.objectOfRevolution3D = function(path, radius, totalAngle, segments, fillColor)
  {
    var pathObj;
    if (typeof path == 'string')
      pathObj = this.compileSvgPath3D(path);  // assume it is imported from Inkscape
    else
      pathObj = this.compilePath3D(path);
    var grp = [];
    var startX = 0;
    var startY = 0;
    var endX = 0;
    var endY = 0;
    var panel, panelCmds, pp1Cmds, panelObj;
    var topRim, botRim;
    var topRimObj, botRimObj, topRimCmds;

    radius = Math.abs(radius);
    var totA = totalAngle || 360;
    var segs = segments || 6;
    var segAng = totA / segs;           // included angle of each segment
    var color = this.paintCol;
    if (typeof fillColor != 'undefined')
      color = fillColor;

    var profile_0 = pathObj.clone(); // make a copy
    var profile_1 = pathObj.clone(); // two needed (not new reference)
    // calc origin coords given start coords of profile and the radius
    var orgX = profile_0.drawCmds[0].ep.x - radius;   // x coord of origin (center of rotation at top of profile)
    // move the profile to have origin at top center of rotation
    profile_0.translate(-orgX, 0, 0);  // 3D coords
    profile_1.translate(-orgX, 0, 0);  // 3D coords
    // now this profile must be rotated by the segment angle to form the other side
    profile_1.rotate(0, segAng, 0);   // rotate segment by segAng out of screen

    for (var n=0; n<segs; n++)
    {
      for (var m = 1; m<profile_0.drawCmds.length; m++)   // first drawCmd is moveTo, skip this
      {
        // construct a panel from top and bottom arcs and 2 copies of profile segment
        startX = profile_0.drawCmds[m-1].ep.x;
        startY = profile_0.drawCmds[m-1].ep.y;
        endX = profile_0.drawCmds[m].ep.x;
        endY = profile_0.drawCmds[m].ep.y;
        if (startX > 3) // make a topRim if profile doesn't start at centre
        {
          // top rim (drawn in xy), endpoint will be where this profile slice starts
          topRim = genSvgArc(0, 0, startX, segAng, 0, 0);  // generate SVG cmds for top arc
          // shove them into an object to enable rotate and translate
          topRimObj = this.compilePath3D(topRim, color);
          // topRim is in xy plane must be rotated to be in xz plane to join profile
          topRimObj.rotate(-90, 0, 0);         // flip top out of screen
          topRimObj.translate(0, startY, 0);   // move up from y=0 to top of profile slice
          // use topRim drawCmds to start the panel array of DrawCmd3Ds
          panel = topRimObj.drawCmds;
        }
        else
        {
          // construct a moveTo command from end point of last command
          topRimCmds = new DrawCmd3D("moveTo", [], profile_0.drawCmds[m-1].ep.clone());
          panel = [topRimCmds];     // use this to start the panel DrawCmd3Ds array
        }
        // copy the profile_0's DrawCmd3D for this segment, push it into panel drawCmds
        panelCmds = profile_0.drawCmds[m].clone();
        panel.push(panelCmds);
        if (endX > 3)  // make the bottom rim if it has any size
        {
          botRim = genSvgArc(0, 0, endX, 0, -segAng, 0);
          // shove them into an object to enable rotate and translate
          botRimObj = this.compilePath3D(botRim, color);
          // rim is in xy plane rotate to be in xz plane
          botRimObj.rotate(90, 0, 0);       // flip bottom up to be out of screen
          botRimObj.translate(0, endY, 0);   // move down from y=0 to bottom of profile
          // now this is an moveTo and a bezierCurveTo, drop the 'moveTo'
          panel.push(botRimObj.drawCmds[1]);  // only 1 Bezier here
        }
        // construct a DrawCmd3D going backward up profile_1
        pp1Cmds = new DrawCmd3D(profile_1.drawCmds[m].drawFn.slice(0), [], profile_1.drawCmds[m-1].ep.clone());
        // change order of cPts if its a Bezier
        if (profile_1.drawCmds[m].cPts.length)
        {
          pp1Cmds.cPts.push(profile_1.drawCmds[m].cPts[1].clone());
          pp1Cmds.cPts.push(profile_1.drawCmds[m].cPts[0].clone());
        }
        panel.push(pp1Cmds);  // now add retrace path to the panel commands
        // make an Obj3D for this panel
        panelObj = new Obj3D(this, panel, this.objType.SHAPE, color);
        // now add the complete panel to the array which makes the final shape
        grp.push(panelObj);
      }
      // rotate the previously made panels out of the way of next segment
      grp.rotate(0, segAng, 0);
     }
    return grp;
  }

  /*=========================================================
   * Generate the SVG format array for a circular arc with
   * center as start piont (cnvas style) convert to SVG style
   * The actual arc will compile to Bezier curves by Cango
   * (these can be rotated in 3D and hold their shape.
   * Assumes Cango coords, y +ve up, angles +ve CCW.
   * The arc center is at cx, cy. Arc starts from startAngle
   * and ends at endAngle. startAngle and endAngle are in
   * degrees. The arc radius is r (in world coords). If
   * antiClockwise is true the arc is traversed ccw, if false
   * it is traversed cw.
   *---------------------------------------------------------*/
  function genSvgArc(cx, cy, r, startAngle, endAngle, antiClockwise)
  {
    var stRad = startAngle * Math.PI/180;
    var edRad = endAngle * Math.PI/180;
    var m = 0.55228475;                 // magic number for drawing circle with 4 Bezier curve

    var oy = cy + r*Math.sin(stRad);   // coords of start point for circlular arc with center (cx,cy)
    var ox = cx + r*Math.cos(stRad);
    var ey = cy + r*Math.sin(edRad);   // coords of end point for circlular arc with center (cx,cy)
    var ex = cx + r*Math.cos(edRad);
    var rotX = 0;     // tilt of x axis, always 0 for circular arc
    var lrgArc = 0;   // always use small so 0
    var ccw = (antiClockwise? 1 : 0);
    var delta = 0;
    var svgData, seg;
    var swp = 1 - ccw;       // 0=ccw 1=cw   (flipped for this ccw +ve world)

    delta = (ccw)? edRad - stRad :stRad - edRad;
    if (delta < 0)
      delta += 2*Math.PI;
    if (delta > 2* Math.PI)
      delta -= 2*Math.PI;
    lrgArc = delta > Math.PI? 1: 0;

    // dont try to draw full circle or no circle
    if ((Math.abs(delta) < 0.01) || (Math.abs(delta) > 2*Math.PI-0.01))
      svgData = ["M",cx, cy-r,"C",cx+m*r, cy-r, cx+r, cy-m*r, cx+r, cy,   cx+r, cy+m*r, cx+m*r, cy+r, cx, cy+r,  cx-m*r, cy+r, cx-r, cy+m*r, cx-r, cy, cx-r, cy-m*r, cx-m*r, cy-r, cx, cy-r];
    else
      svgData = ["M", ox, oy, "A", r, r, 0, lrgArc, swp, ex, ey];

    return svgData
  }

  Cango3D.prototype.segsToDrawCmds3D = function(segs, xRef, yRef, xScl, yScl)
  {
    var x = 0;
    var y = 0;
    var cPts;        // array of control points
    var ep;          // end point
    var px,py;
    var seg, cmd, pc;
    var cmdObj;
    var commands = [];
    var xScale = xScl || 1;
    var yScale = yScl || 1;
    var xOfs = xRef || 0;                 // move the shape reference point
    var yOfs = yRef || 0;
  
    for (var i=0; i<segs.length; i++)
    {
      seg = segs[i];
      cmd = seg[0];
      if ((i==0)&&(cmd != 'M'))   // check that the first move is absolute
        cmd = 'M';
      var coords = seg.slice(1);
      if (coords)
        coords = coords.map(parseFloat);
      switch(cmd)
      {
        case 'M':
          x = xOfs + xScale*coords[0];
          y = yOfs + yScale*coords[1];
          px = py = null;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          coords.splice(0, 2);      // delete the 2 coords from the front of the array
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];                // eqiv to muliple 'L' calls
            y = yOfs + yScale*coords[1];
            cPts = [];
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          break
        case 'm':
          x += xScale*coords[0];
          y += yScale*coords[1];
          px = py = null;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('moveTo', cPts, ep);
          commands.push(cmdObj);
          coords.splice(0, 2);      // delete the 2 coords from the front of the array
          while (coords.length>0)
          {
            x += xScale*coords[0];                     // eqiv to muliple 'l' calls
            y += yScale*coords[1];
            cPts = [];
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          break
  
        case 'L':
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];
            y = yOfs + yScale*coords[1];
            cPts = [];
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          px = py = null;
          break
        case 'l':
          while (coords.length>0)
          {
            x += xScale*coords[0];
            y += yScale*coords[1];
            cPts = [];
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('lineTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          px = py = null
          break
        case 'H':
          x = xOfs + xScale*coords[0];
          px = py = null ;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'h':
          x += xScale*coords[0];
          px = py = null ;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'V':
          y = yOfs + yScale*coords[0];
          px = py = null;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'v':
          y += yScale*coords[0];
          px = py = null;
          cPts = [];
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('lineTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'C':
          while (coords.length>0)
          {
            c1x = xOfs + xScale*coords[0];
            c1y = yOfs + yScale*coords[1];
            px = xOfs + xScale*coords[2];
            py = yOfs + yScale*coords[3];
            x = xOfs + xScale*coords[4];
            y = yOfs + yScale*coords[5];
            cPts = [];
            cPts[0] = new Point(c1x, c1y, 0);
            cPts[1] = new Point(px, py, 0);
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 6);
          }
          break
        case 'c':
          while (coords.length>0)
          {
            c1x = x + xScale*coords[0];
            c1y = y + yScale*coords[1];
            px = x + xScale*coords[2];
            py = y + yScale*coords[3];
            x += xScale*coords[4];
            y += yScale*coords[5];
            cPts = [];
            cPts[0] = new Point(c1x, c1y, 0);
            cPts[1] = new Point(px, py, 0);
            ep = new Point(x, y, 0);
            cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
            commands.push(cmdObj);
            coords.splice(0, 6);
          }
          break
        case 'S':
          if (px == null || !pc.match(/[sc]/i))
          {
            px = x;                // already absolute coords
            py = y;
          }
          cPts = [];
          cPts[0] = new Point(x-(px-x), y-(py-y), 0);
          cPts[1] = new Point(xOfs + xScale*coords[0], yOfs + yScale*coords[1], 0);
          ep = new Point(xOfs + xScale*coords[2], yOfs + yScale*coords[3], 0);
          cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
          commands.push(cmdObj);
          px = xOfs + xScale*coords[0];
          py = yOfs + yScale*coords[1];
          x = xOfs + xScale*coords[2];
          y = yOfs + yScale*coords[3];
          break
        case 's':
          if (px == null || !pc.match(/[sc]/i))
          {
            px = x;
            py = y;
          }
          cPts = [];
          cPts[0] = new Point(x-(px-x), y-(py-y), 0);
          cPts[1] = new Point(x + xScale*coords[0], y + yScale*coords[1], 0);
          ep = new Point(x + xScale*coords[2], y + yScale*coords[3], 0);
          cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
          commands.push(cmdObj);
          px = x + xScale*coords[0];
          py = y + yScale*coords[1];
          x += xScale*coords[2];
          y += yScale*coords[3];
          break
        case 'Q':
          px = xOfs + xScale*coords[0];
          py = yOfs + yScale*coords[1];
          x = xOfs + xScale*coords[2];
          y = yOfs + yScale*coords[3];
          cPts = [];
          cPts[0] = new Point(px, py, 0);
          ep = new Point(x, y, 0);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          break
        case 'q':
          cPts = [];
          cPts[0] = new Point(x + xScale*coords[0], y + yScale*coords[1], 0);
          ep = new Point(x + xScale*coords[2], y + yScale*coords[3], 0);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          px = x + xScale*coords[0];
          py = y + yScale*coords[1];
          x += xScale*coords[2];
          y += yScale*coords[3];
          break
        case 'T':
          if (px == null || !pc.match(/[qt]/i))
          {
            px = x;
            py = y;
          }
          else
          {
            px = x-(px-x);
            py = y-(py-y);
          }
          cPts = [];
          cPts[0] = new Point(px, py, 0);
          ep = new Point(xOfs + xScale*coords[0], yOfs + yScale*coords[1], 0);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          px = x-(px-x);
          py = y-(py-y);
          x = xOfs + xScale*coords[0];
          y = yOfs + yScale*coords[1];
          break
        case 't':
          if (px == null || !pc.match(/[qt]/i))
          {
            px = x;
            py = y;
          }
          else
          {
            px = x-(px-x);
            py = y-(py-y);
          }
          cPts = [];
          cPts[0] = new Point(px, py, 0);
          ep = new Point(x + xScale*coords[0], y + yScale*coords[1], 0);
          cmdObj = new DrawCmd3D('quadraticCurveTo', cPts, ep);
          commands.push(cmdObj);
          x += xScale*coords[0];
          y += yScale*coords[1];
          break
        case 'A':
          while (coords.length>0)
          {
            px = x;
            py = y;
            rx = xScale*coords[0];
            ry = xScale*coords[1];
            rot = -coords[2];          // rotationX: swap for CCW +ve
            larc = coords[3];          // large arc    should be ok
            swp = 1 - coords[4];       // sweep: swap for CCW +ve
            x = xOfs + xScale*coords[5];
            y = yOfs + yScale*coords[6];
            arc_segs = arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
            for (var l=0; l<arc_segs.length; l++)
            {
              cPts = [];
          		cPts[0] = new Point(arc_segs[l][0], arc_segs[l][1], 0);
          		cPts[1] = new Point(arc_segs[l][2], arc_segs[l][3], 0);
           		ep = new Point(arc_segs[l][4], arc_segs[l][5], 0);
           		cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
           		commands.push(cmdObj);
   	        }
            coords.splice(0, 7);
          }
          break
        case 'a':
          while (coords.length>0)
          {
            px = x;
            py = y;
            rx = xScale*coords[0];
            ry = xScale*coords[1];
            rot = -coords[2];          // rotationX: swap for CCW +ve
            larc = coords[3];          // large arc    should be ok
            swp = 1 - coords[4];       // sweep: swap for CCW +ve
            x += xScale*coords[5];
            y += yScale*coords[6];
            arc_segs = arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
            for (var l=0; l<arc_segs.length; l++)
            {
          		cPts = [];
          		cPts[0] = new Point(arc_segs[l][0], arc_segs[l][1], 0);
          		cPts[1] = new Point(arc_segs[l][2], arc_segs[l][3], 0);
          		ep = new Point(arc_segs[l][4], arc_segs[l][5], 0);
          		cmdObj = new DrawCmd3D('bezierCurveTo', cPts, ep);
          		commands.push(cmdObj);
            }
            coords.splice(0, 7);
          }
          break
        case 'Z':
          cmdObj = new DrawCmd3D('closePath');
          commands.push(cmdObj);
          break
        case 'z':
          cmdObj = new DrawCmd3D('closePath');
          commands.push(cmdObj);
          break
      }
      pc = cmd     // save the previous command for possible reflected control points
    }
    return commands
  }
  
  function arcToBezier(ox, oy, rx, ry, rotateX, large, sweep, x, y)
  {
    var th = rotateX * (Math.PI/180)
    var sin_th = Math.sin(th)
    var cos_th = Math.cos(th)
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    var px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5
    var py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5
    var pl = (px*px) / (rx*rx) + (py*py) / (ry*ry)
    if (pl > 1)
    {
      pl = Math.sqrt(pl)
      rx *= pl
      ry *= pl
    }
  
    var a00 = cos_th / rx
    var a01 = sin_th / rx
    var a10 = (-sin_th) / ry
    var a11 = (cos_th) / ry
    var x0 = a00 * ox + a01 * oy
    var y0 = a10 * ox + a11 * oy
    var x1 = a00 * x + a01 * y
    var y1 = a10 * x + a11 * y
  
    var d = (x1-x0) * (x1-x0) + (y1-y0) * (y1-y0)
    var sfactor_sq = 1 / d - 0.25
    if (sfactor_sq < 0)
      sfactor_sq = 0
    var sfactor = Math.sqrt(sfactor_sq)
    if (sweep == large)
      sfactor = -sfactor
    var xc = 0.5 * (x0 + x1) - sfactor * (y1-y0)
    var yc = 0.5 * (y0 + y1) + sfactor * (x1-x0)
  
    var th0 = Math.atan2(y0-yc, x0-xc)
    var th1 = Math.atan2(y1-yc, x1-xc)
  
    var th_arc = th1-th0
    if (th_arc < 0 && sweep == 1)
    {
      th_arc += 2*Math.PI
    }
    else if (th_arc > 0 && sweep == 0)
    {
      th_arc -= 2 * Math.PI
    }
  
    var segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)))
    var result = []
    for (var i=0; i<segments; i++)
    {
      var th2 = th0 + i * th_arc / segments
      var th3 = th0 + (i+1) * th_arc / segments
      result.push(segmentToBezier(xc, yc, th2, th3, rx, ry, sin_th, cos_th));
    }
  
    return result
  }
  
  function segmentToBezier(cx, cy, th0, th1, rx, ry, sin_th, cos_th)
  {
    var a00 = cos_th * rx
    var a01 = -sin_th * ry
    var a10 = sin_th * rx
    var a11 = cos_th * ry
  
    var th_half = 0.5 * (th1 - th0)
    var t = (8/3) * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half)
    var x1 = cx + Math.cos(th0) - t * Math.sin(th0)
    var y1 = cy + Math.sin(th0) + t * Math.cos(th0)
    var x3 = cx + Math.cos(th1)
    var y3 = cy + Math.sin(th1)
    var x2 = x3 + t * Math.sin(th1)
    var y2 = y3 - t * Math.cos(th1)
    return [
              a00 * x1 + a01 * y1, a10 * x1 + a11 * y1,
              a00 * x2 + a01 * y2, a10 * x2 + a11 * y2,
              a00 * x3 + a01 * y3, a10 * x3 + a11 * y3
            ]
  }
  
  if (!Array.prototype.map)
  {
    Array.prototype.map = function(fun)
    {
      var len = this.length;
      if (typeof fun != "function")
        throw new TypeError();
  
      var res = new Array(len);
      var thisp = arguments[1];
      for (var i = 0; i < len; i++)
      {
        if (i in this)
          res[i] = fun.call(thisp, this[i], i, this);
      }
  
      return res;
    };
  }
  
  /* =============================================================
   * DrawCmd3D
   * - drawFn: String, the canvas draw command name
   * - cPts: Array, [Point, Point ...] Bezier curve control points
   * - ep: Point, end point of the drawFn
   *--------------------------------------------------------------
   */
  function DrawCmd3D(cmdStr, controlPoints, endPoint)
  {
    this.drawFn = cmdStr;   // String version of the canvas command to call
    this.cPts = controlPoints || [];  // array of parameters to pass to drawFn
    this.ep = endPoint;         //may be undefined (for 'Z')
  }

  /* ======================================================================
   * DrawCmd is a HTML5 canvas 2D draw command in the form of a string
   * this.drawFn (eg "moveTo") and a set of 2D coords 'this.parms' to pass
   * to the command (eg [5, 20] the pen will move to 5,20 in canvas coords.
   * ----------------------------------------------------------------------
   */
  if (typeof DrawCmd == 'undefined')   // avoid clash with DrawCmd from 2D canvas graphics
  {
    function DrawCmd(cmdStr, coords)
    {
      this.drawFn = cmdStr;       // String version of the canvas command to call
      this.parms = coords || [];  // array of parameters to pass to drawFn
    }
  }

  function Obj3D(cgo, commands, type, col)
  {
    this.drawCmds = commands || [];           // array of DrawCmd3D objects
    this.strokeColor = "black";               // used for PATHs and SHAPE text
    this.fillColor = "gray";                  // used to fill SHAPEs
    this.strokeWidth = 1;
    this.type = type;                         // PATH, SHAPE, TEXT
    this.closed = (type == 1)? true : false;  // type 1 == SHAPE, they are always closed
    this.drawData = [];                       // 2D draw commands in format {string, [points]}
    this.origin = new Point(0, 0, 0);
    this.normal = new Point(0, 0, 0);
    this.textCmds = [];                       // holds cmds to draw SHAPE label
    this.textData = [];                       // 2D draw commands in format {string, [points]}

    if ((typeof cgo != 'undefined')&&(cgo != null)&&(commands.length))
    {
      // SHAPE and PATH only pass 'col' it can be stroke or fill
      if (typeof col != 'undefined')
      {
        if (type == cgo.objType.SHAPE)
        {
          this.fillColor = col;
        }
        else // PATHs
        {
          this.strokeColor = col;
        }
      }
      else
      {
        this.fillColor = cgo.paintCol;
        this.strokeColor = cgo.penCol;
      }

      var xSum = 0;
      var ySum = 0;
      var zSum = 0;
      var numPts = 0;    // total point counter for all commands
      for (var i=0; i<this.drawCmds.length; i++)
      {
        if (this.drawCmds[i].ep != undefined)  // check for Z command, has no coords
        {
          xSum += this.drawCmds[i].ep.x;
          ySum += this.drawCmds[i].ep.y;
          zSum += this.drawCmds[i].ep.z;
          numPts++;
        }
      }
      this.origin.x = xSum/numPts;
      this.origin.y = ySum/numPts;
      this.origin.z = zSum/numPts;

      if (this.drawCmds.length > 2)    //
      {
        // make the normal(o, b, a)  = aXb, a is vector from origin to data[0], b is from origin to data[1]
        this.normal = _normal(this.origin, this.drawCmds[1].ep, this.drawCmds[0].ep);
        // NOTE: traverse CW normal is out of screen (-z), traverse path CCW normal is into screen (+z)
        //make 10 pixels long (independent of world coords
        this.normal.x *= 10/cgo.xscl;
        this.normal.y *= 10/cgo.xscl;
        this.normal.z *= 10/cgo.xscl;
      }
      else
      {
        if (this.drawCmds.length == 2)    // if Bezier it will need a normal
        {
          if (this.drawCmds[1].cPts.length)
            this.normal = _normal(this.origin, this.drawCmds[0].ep, this.drawCmds[1].cPts[1]);
          else
            // striaght line make normal for completeness
            this.normal.z = -10/cgo.xscl;
        }
        else
          return;
      }
      // move normal to start from the origin
      this.normal.x += this.origin.x;
      this.normal.y += this.origin.y;
      this.normal.z += this.origin.z;
    }
  }

  /*=========================================================
   * Obj3D.translate
   * Generate a transformation matrix to translate a 3D point
   * away to a position x,y,z from its drawing origin.
   * Then multiply every point in an Obj3D, or array of Obj3D
   * including their origin and normal by this matrix.
   * The transformed x,y,z values overwrite the current
   * values.
   *
   * This function should be used in shape
   * construction not animation. Animation doesn't change
   * x,y,z, it uses them to get tx,ty,tz.
   *---------------------------------------------------------
   */
  Obj3D.prototype.translate = function(x, y, z)
  {
    var j, k;

    var xfrm = genTranslateMatrix(x, y, z);

    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], xfrm);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, xfrm);
      }
    }
    transformPoint(this.origin, xfrm);    // translate the origin
    transformPoint(this.normal, xfrm);    // translate the normal

    if (this.textCmds.length>0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], xfrm);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, xfrm);
        }
      }
    }
  }

  /*======================================
   * Allow the translate method to operate
   * on arrays of obj3D as well
   *-------------------------------------*/
  Array.prototype.translate = function(x, y, z)
  {
    // do nothing if array elements are not Obj3Ds
    if (!this[0].drawCmds.length)
      return;
    for (i=0;i<this.length;i++)
    {
      this[i].translate(x, y, z);
    }
  }

  Obj3D.prototype.rotate = function(xRot, yRot, zRot)
  {
    var t = Math.PI/180.0;
    var j, k;

    var xfrm = genRotateMatrix(xRot*t, yRot*t, zRot*t);

    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], xfrm);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, xfrm);
      }
    }
    transformPoint(this.origin, xfrm);    // rotate the origin
    transformPoint(this.normal, xfrm);    // rotate the normal

    if (this.textCmds.length > 0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], xfrm);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, xfrm);
        }
      }
    }
  }

  /*======================================
   * Allow the rotate method to operate
   * on arrays of obj3D as well
   *-------------------------------------*/
  Array.prototype.rotate = function(xRot, yRot, zRot)
  {
    // do nothing if array elements are not Obj3Ds
    if (!this[0].drawCmds.length)
      return;
    for (i=0;i<this.length;i++)
    {
      this[i].rotate(xRot, yRot, zRot);
    }
  }

  /*=========================================================
   * Obj3D.scale
   * Generate a transformation matrix to scale a 3D point
   * relative to its drawing origin.
   * Then multiply every point in an Obj3D, or array of Obj3D
   * including their origin and normal by this matrix.
   * The transformed x,y,z values overwrite the current
   * values.
   *
   * This function should be used in shape
   * construction not animation. Animation doesn't change
   * x,y,z, it uses them to get tx,ty,tz.
   *---------------------------------------------------------
   */
  Obj3D.prototype.scale = function(s)
  {
    var j, k;

    var xfrm = genScaleMatrix(Math.abs(s));

    for(j=0; j < this.drawCmds.length; j++)   // step through the draw segments
    {
      for (k=0; k<this.drawCmds[j].cPts.length; k++)   // transform each 3D Point
      {
        transformPoint(this.drawCmds[j].cPts[k], xfrm);
      }
      // add the end point (check it exists since 'closePath' has no end point)
      if (this.drawCmds[j].ep != undefined)
      {
        transformPoint(this.drawCmds[j].ep, xfrm);
      }
    }
    transformPoint(this.origin, xfrm);    // translate the origin
    transformPoint(this.normal, xfrm);    // translate the normal

    if (this.textCmds.length>0)
    {
      for(j=0; j<this.textCmds.length; j++)   // step through the draw segments
      {
        for (k=0; k<this.textCmds[j].cPts.length; k++)   // transform each 3D Point
        {
          transformPoint(this.textCmds[j].cPts[k], xfrm);
        }
        // add the end point (check it exists since 'closePath' has no end point)
        if (this.textCmds[j].ep != undefined)
        {
          transformPoint(this.textCmds[j].ep, xfrm);
        }
      }
    }
  }

  /*======================================
   * Allow the scale method to operate
   * on arrays of obj3D as well
   *-------------------------------------*/
  Array.prototype.scale = function(s)
  {
    // do nothing if array elements are not Obj3Ds
    if (!this[0].drawCmds.length)
      return;
    for (i=0;i<this.length;i++)
    {
      this[i].scale(s);
    }
  }




  /* create a copy (not just a reference) of an object */
  Object.prototype.clone = function()
  {
    var newObj = (this instanceof Array) ? [] : {};
    for (i in this)
    {
      if (i == 'clone') continue;
      if (this[i] && typeof this[i] == "object")
      {
        newObj[i] = this[i].clone();
      }
      else
        newObj[i] = this[i]
    }
    return newObj;
  }

  function identityMatrix()
  {
    return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
          ];
  }

  /* Multiply two matricies */
  function matrixMultiply(m1, m2)
  {
    var result = identityMatrix();

    var cols = m1[0].length;
    var rows = m1.length;

    if (cols != m2.length)
      alert("matrix size error");

    for (var x = 0; x < cols; x++)
    {
      for (var y = 0; y < rows; y++)
      {
        var sum = 0;
        for (var z = 0; z < cols; z++)
        {
          sum += m1[y][z] * m2[z][x];
        }

        result[y][x] = sum;
      }
    }
    return result;
  }

  /* Generate a matrix to rotate a 3D vector. */
  function genRotateMatrix(x, y, z)
  {
    var result = identityMatrix();

    if (z)
    {
      var cosZ = Math.cos(-z);
      var sinZ = Math.sin(-z);
      var rotZ = [
                  [cosZ, -sinZ, 0, 0],
                  [sinZ,  cosZ, 0, 0],
                  [   0,     0, 1, 0],
                  [   0,     0, 0, 1]
                 ];

      result = matrixMultiply(result, rotZ);
    }

    if (y)
    {
      var cosY = Math.cos(-y);
      var sinY = Math.sin(-y);
      var rotY = [
                  [ cosY, 0, sinY, 0],
                  [    0, 1,    0, 0],
                  [-sinY, 0, cosY, 0],
                  [    0, 0,    0, 1]
                 ];

      result = matrixMultiply(result, rotY);
    }

    if (x)
    {
      var cosX = Math.cos(-x);
      var sinX = Math.sin(-x);
      var rotX = [
                  [1,    0,     0, 0],
                  [0, cosX, -sinX, 0],
                  [0, sinX,  cosX, 0],
                  [0,    0,     0, 1]
                 ];
      result = matrixMultiply(result, rotX);
    }
    return result;
  }

  /* Generate a matrix to translate (move) a 3D vector  */
  function genTranslateMatrix(x, y, z)
  {
    return [
             [1, 0, 0, 0],
             [0, 1, 0, 0],
             [0, 0, 1, 0],
             [x, y, z, 1]
           ];
  }

  /* Generate a matrix to scale a 3D vector  */
  function genScaleMatrix(s)
  {
    return [
             [s, 0, 0, 0],
             [0, s, 0, 0],
             [0, 0, s, 0],
             [0, 0, 0, 1]
           ];
  }

  /* Transforms a point using the current transformation matrix */
  function transformPoint(point, xfrm)
  {
    var p = [[point.x, point.y, point.z, 1]];
    var pm = matrixMultiply(p, xfrm);

    point.x = pm[0][0];
    point.y = pm[0][1];
    point.z = pm[0][2];

    point.tx = point.x;
    point.ty = point.y;
    point.tz = point.z;
  }

  function softTransformPoint(point, xfrm)
  {
    var p = [[point.x, point.y, point.z, 1]];
    var pm = matrixMultiply(p, xfrm);

    point.tx = pm[0][0];
    point.ty = pm[0][1];
    point.tz = pm[0][2];
  }


  /* =========================================================
   * Generate the Normal to a plane, given 3 points (3D)
   * which define a plane.
   * The vector returned starts at 0,0,0
   * is 10 units long in direction perpendicular to the plane.
   * Calculates A X B where p3-p1=A, p2-p1=B
   * ---------------------------------------------------------
   */
  function _normal(p1, p2, p3)
  {
    var a = new Point(p3.x-p1.x, p3.y-p1.y, p3.z-p1.z);   // vector from p1 to p3
    var b = new Point(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z);   // vector from p1 to p2
    // a and b lie in the plane, a x b (cross product) is normal to both ie normal to plane
    // left handed coord system use left hand to get X product direction
    var nx = a.y*b.z - a.z*b.y;
    var ny = a.z*b.x - a.x*b.z;
    var nz = a.x*b.y - a.y*b.x;
    var mag = Math.sqrt(nx*nx + ny*ny + nz*nz);  // make 'unit' vector 10px long

    var n = new Point(nx/mag, ny/mag, nz/mag);

    return n
  }

  /* =====================================================================
   * A 3d coordinate (left handed system)
   *
   * X +ve right
   * Y +ve up
   * Z +ve into screen
   * --------------------------------------------------------------------
   */
  function Point(x, y, z)
  {
    this.x = x;
    this.y = y;
    this.z = z;

    // Translated, rotated
    this.tx = x;
    this.ty = y;
    this.tz = z;

    // tx, ty, tz, projected to 2D as seen from viewpoint
    this.fx;
    this.fy;
  }

  // ============ useful objects for animation, these are returned by 3D path functions ============
  // constructor for position and rotation state for moving an object in 3D.
  function State3D(x, y, z, xRot, yRot, zRot, cx, cy, cz)
  {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.xRot = xRot || 0;
    this.yRot = yRot || 0;
    this.zRot = zRot || 0;
    this.cx = cx || 0;     // center of rotation
    this.cy = cy || 0;
    this.cz = cz || 0;
  }


  var CanvasTextFunctions = { };
  //
  // This code is released to the public domain by Jim Studt, 2007.
  // He may keep some sort of up to date copy at http://www.federated.com/~jim/canvastext/
  //

  CanvasTextFunctions.letters = {
      ' ': { width: 16, points: [] },
      '!': { width: 10, points: [[5,21],[5,7],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '"': { width: 16, points: [[4,21],[4,14],[-1,-1],[12,21],[12,14]] },
      '#': { width: 21, points: [[11,25],[4,-7],[-1,-1],[17,25],[10,-7],[-1,-1],[4,12],[18,12],[-1,-1],[3,6],[17,6]] },
      '$': { width: 20, points: [[8,25],[8,-4],[-1,-1],[12,25],[12,-4],[-1,-1],[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      '%': { width: 24, points: [[21,21],[3,0],[-1,-1],[8,21],[10,19],[10,17],[9,15],[7,14],[5,14],[3,16],[3,18],[4,20],[6,21],[8,21],[10,20],[13,19],[16,19],[19,20],[21,21],[-1,-1],[17,7],[15,6],[14,4],[14,2],[16,0],[18,0],[20,1],[21,3],[21,5],[19,7],[17,7]] },
      '&': { width: 26, points: [[23,12],[23,13],[22,14],[21,14],[20,13],[19,11],[17,6],[15,3],[13,1],[11,0],[7,0],[5,1],[4,2],[3,4],[3,6],[4,8],[5,9],[12,13],[13,14],[14,16],[14,18],[13,20],[11,21],[9,20],[8,18],[8,16],[9,13],[11,10],[16,3],[18,1],[20,0],[22,0],[23,1],[23,2]] },
      '\'': { width: 10, points: [[5,19],[4,20],[5,21],[6,20],[6,18],[5,16],[4,15]] },
      '(': { width: 14, points: [[11,25],[9,23],[7,20],[5,16],[4,11],[4,7],[5,2],[7,-2],[9,-5],[11,-7]] },
      ')': { width: 14, points: [[3,25],[5,23],[7,20],[9,16],[10,11],[10,7],[9,2],[7,-2],[5,-5],[3,-7]] },
      '*': { width: 16, points: [[8,21],[8,9],[-1,-1],[3,18],[13,12],[-1,-1],[13,18],[3,12]] },
      '+': { width: 26, points: [[13,18],[13,0],[-1,-1],[4,9],[22,9]] },
      ',': { width: 10, points: [[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '-': { width: 26, points: [[4,9],[22,9]] },
      '.': { width: 10, points: [[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '/': { width: 22, points: [[20,25],[2,-7]] },
      '0': { width: 20, points: [[9,21],[6,20],[4,17],[3,12],[3,9],[4,4],[6,1],[9,0],[11,0],[14,1],[16,4],[17,9],[17,12],[16,17],[14,20],[11,21],[9,21]] },
      '1': { width: 20, points: [[6,17],[8,18],[11,21],[11,0]] },
      '2': { width: 20, points: [[4,16],[4,17],[5,19],[6,20],[8,21],[12,21],[14,20],[15,19],[16,17],[16,15],[15,13],[13,10],[3,0],[17,0]] },
      '3': { width: 20, points: [[5,21],[16,21],[10,13],[13,13],[15,12],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '4': { width: 20, points: [[13,21],[3,7],[18,7],[-1,-1],[13,21],[13,0]] },
      '5': { width: 20, points: [[15,21],[5,21],[4,12],[5,13],[8,14],[11,14],[14,13],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '6': { width: 20, points: [[16,18],[15,20],[12,21],[10,21],[7,20],[5,17],[4,12],[4,7],[5,3],[7,1],[10,0],[11,0],[14,1],[16,3],[17,6],[17,7],[16,10],[14,12],[11,13],[10,13],[7,12],[5,10],[4,7]] },
      '7': { width: 20, points: [[17,21],[7,0],[-1,-1],[3,21],[17,21]] },
      '8': { width: 20, points: [[8,21],[5,20],[4,18],[4,16],[5,14],[7,13],[11,12],[14,11],[16,9],[17,7],[17,4],[16,2],[15,1],[12,0],[8,0],[5,1],[4,2],[3,4],[3,7],[4,9],[6,11],[9,12],[13,13],[15,14],[16,16],[16,18],[15,20],[12,21],[8,21]] },
      '9': { width: 20, points: [[16,14],[15,11],[13,9],[10,8],[9,8],[6,9],[4,11],[3,14],[3,15],[4,18],[6,20],[9,21],[10,21],[13,20],[15,18],[16,14],[16,9],[15,4],[13,1],[10,0],[8,0],[5,1],[4,3]] },
      ':': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      ';': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '<': { width: 24, points: [[20,18],[4,9],[20,0]] },
      '=': { width: 26, points: [[4,12],[22,12],[-1,-1],[4,6],[22,6]] },
      '>': { width: 24, points: [[4,18],[20,9],[4,0]] },
      '?': { width: 18, points: [[3,16],[3,17],[4,19],[5,20],[7,21],[11,21],[13,20],[14,19],[15,17],[15,15],[14,13],[13,12],[9,10],[9,7],[-1,-1],[9,2],[8,1],[9,0],[10,1],[9,2]] },
      '@': { width: 27, points: [[18,13],[17,15],[15,16],[12,16],[10,15],[9,14],[8,11],[8,8],[9,6],[11,5],[14,5],[16,6],[17,8],[-1,-1],[12,16],[10,14],[9,11],[9,8],[10,6],[11,5],[-1,-1],[18,16],[17,8],[17,6],[19,5],[21,5],[23,7],[24,10],[24,12],[23,15],[22,17],[20,19],[18,20],[15,21],[12,21],[9,20],[7,19],[5,17],[4,15],[3,12],[3,9],[4,6],[5,4],[7,2],[9,1],[12,0],[15,0],[18,1],[20,2],[21,3],[-1,-1],[19,16],[18,8],[18,6],[19,5]] },
      'A': { width: 18, points: [[9,21],[1,0],[-1,-1],[9,21],[17,0],[-1,-1],[4,7],[14,7]] },
      'B': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[-1,-1],[4,11],[13,11],[16,10],[17,9],[18,7],[18,4],[17,2],[16,1],[13,0],[4,0]] },
      'C': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5]] },
      'D': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[11,21],[14,20],[16,18],[17,16],[18,13],[18,8],[17,5],[16,3],[14,1],[11,0],[4,0]] },
      'E': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11],[-1,-1],[4,0],[17,0]] },
      'F': { width: 18, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11]] },
      'G': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[18,8],[-1,-1],[13,8],[18,8]] },
      'H': { width: 22, points: [[4,21],[4,0],[-1,-1],[18,21],[18,0],[-1,-1],[4,11],[18,11]] },
      'I': { width: 8, points: [[4,21],[4,0]] },
      'J': { width: 16, points: [[12,21],[12,5],[11,2],[10,1],[8,0],[6,0],[4,1],[3,2],[2,5],[2,7]] },
      'K': { width: 21, points: [[4,21],[4,0],[-1,-1],[18,21],[4,7],[-1,-1],[9,12],[18,0]] },
      'L': { width: 17, points: [[4,21],[4,0],[-1,-1],[4,0],[16,0]] },
      'M': { width: 24, points: [[4,21],[4,0],[-1,-1],[4,21],[12,0],[-1,-1],[20,21],[12,0],[-1,-1],[20,21],[20,0]] },
      'N': { width: 22, points: [[4,21],[4,0],[-1,-1],[4,21],[18,0],[-1,-1],[18,21],[18,0]] },
      'O': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21]] },
      'P': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,14],[17,12],[16,11],[13,10],[4,10]] },
      'Q': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21],[-1,-1],[12,4],[18,-2]] },
      'R': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[4,11],[-1,-1],[11,11],[18,0]] },
      'S': { width: 20, points: [[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      'T': { width: 16, points: [[8,21],[8,0],[-1,-1],[1,21],[15,21]] },
      'U': { width: 22, points: [[4,21],[4,6],[5,3],[7,1],[10,0],[12,0],[15,1],[17,3],[18,6],[18,21]] },
      'V': { width: 18, points: [[1,21],[9,0],[-1,-1],[17,21],[9,0]] },
      'W': { width: 24, points: [[2,21],[7,0],[-1,-1],[12,21],[7,0],[-1,-1],[12,21],[17,0],[-1,-1],[22,21],[17,0]] },
      'X': { width: 20, points: [[3,21],[17,0],[-1,-1],[17,21],[3,0]] },
      'Y': { width: 18, points: [[1,21],[9,11],[9,0],[-1,-1],[17,21],[9,11]] },
      'Z': { width: 20, points: [[17,21],[3,0],[-1,-1],[3,21],[17,21],[-1,-1],[3,0],[17,0]] },
      '[': { width: 14, points: [[4,25],[4,-7],[-1,-1],[5,25],[5,-7],[-1,-1],[4,25],[11,25],[-1,-1],[4,-7],[11,-7]] },
      '\\': { width: 14, points: [[0,21],[14,-3]] },
      ']': { width: 14, points: [[9,25],[9,-7],[-1,-1],[10,25],[10,-7],[-1,-1],[3,25],[10,25],[-1,-1],[3,-7],[10,-7]] },
      '^': { width: 16, points: [[6,15],[8,18],[10,15],[-1,-1],[3,12],[8,17],[13,12],[-1,-1],[8,17],[8,0]] },
      '_': { width: 16, points: [[0,-2],[16,-2]] },
      '`': { width: 10, points: [[6,21],[5,20],[4,18],[4,16],[5,15],[6,16],[5,17]] },
      'a': { width: 19, points: [[15,14],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'b': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'c': { width: 18, points: [[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'd': { width: 19, points: [[15,21],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'e': { width: 18, points: [[3,8],[15,8],[15,10],[14,12],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'f': { width: 12, points: [[10,21],[8,21],[6,20],[5,17],[5,0],[-1,-1],[2,14],[9,14]] },
      'g': { width: 19, points: [[15,14],[15,-2],[14,-5],[13,-6],[11,-7],[8,-7],[6,-6],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'h': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'i': { width: 8, points: [[3,21],[4,20],[5,21],[4,22],[3,21],[-1,-1],[4,14],[4,0]] },
      'j': { width: 10, points: [[5,21],[6,20],[7,21],[6,22],[5,21],[-1,-1],[6,14],[6,-3],[5,-6],[3,-7],[1,-7]] },
      'k': { width: 17, points: [[4,21],[4,0],[-1,-1],[14,14],[4,4],[-1,-1],[8,8],[15,0]] },
      'l': { width: 8, points: [[4,21],[4,0]] },
      'm': { width: 30, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0],[-1,-1],[15,10],[18,13],[20,14],[23,14],[25,13],[26,10],[26,0]] },
      'n': { width: 19, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'o': { width: 19, points: [[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3],[16,6],[16,8],[15,11],[13,13],[11,14],[8,14]] },
      'p': { width: 19, points: [[4,14],[4,-7],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'q': { width: 19, points: [[15,14],[15,-7],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'r': { width: 13, points: [[4,14],[4,0],[-1,-1],[4,8],[5,11],[7,13],[9,14],[12,14]] },
      's': { width: 17, points: [[14,11],[13,13],[10,14],[7,14],[4,13],[3,11],[4,9],[6,8],[11,7],[13,6],[14,4],[14,3],[13,1],[10,0],[7,0],[4,1],[3,3]] },
      't': { width: 12, points: [[5,21],[5,4],[6,1],[8,0],[10,0],[-1,-1],[2,14],[9,14]] },
      'u': { width: 19, points: [[4,14],[4,4],[5,1],[7,0],[10,0],[12,1],[15,4],[-1,-1],[15,14],[15,0]] },
      'v': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0]] },
      'w': { width: 22, points: [[3,14],[7,0],[-1,-1],[11,14],[7,0],[-1,-1],[11,14],[15,0],[-1,-1],[19,14],[15,0]] },
      'x': { width: 17, points: [[3,14],[14,0],[-1,-1],[14,14],[3,0]] },
      'y': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0],[6,-4],[4,-6],[2,-7],[1,-7]] },
      'z': { width: 17, points: [[14,14],[3,0],[-1,-1],[3,14],[14,14],[-1,-1],[3,0],[14,0]] },
      '{': { width: 14, points: [[9,25],[7,24],[6,23],[5,21],[5,19],[6,17],[7,16],[8,14],[8,12],[6,10],[-1,-1],[7,24],[6,22],[6,20],[7,18],[8,17],[9,15],[9,13],[8,11],[4,9],[8,7],[9,5],[9,3],[8,1],[7,0],[6,-2],[6,-4],[7,-6],[-1,-1],[6,8],[8,6],[8,4],[7,2],[6,1],[5,-1],[5,-3],[6,-5],[7,-6],[9,-7]] },
      '|': { width: 8, points: [[4,25],[4,-7]] },
      '}': { width: 14, points: [[5,25],[7,24],[8,23],[9,21],[9,19],[8,17],[7,16],[6,14],[6,12],[8,10],[-1,-1],[7,24],[8,22],[8,20],[7,18],[6,17],[5,15],[5,13],[6,11],[10,9],[6,7],[5,5],[5,3],[6,1],[7,0],[8,-2],[8,-4],[7,-6],[-1,-1],[8,8],[6,6],[6,4],[7,2],[8,1],[9,-1],[9,-3],[8,-5],[7,-6],[5,-7]] },
      '~': { width: 24, points: [[3,6],[3,8],[4,11],[6,12],[8,12],[10,11],[14,8],[16,7],[18,7],[20,8],[21,10],[-1,-1],[3,8],[4,10],[6,11],[8,11],[10,10],[14,7],[16,6],[18,6],[20,7],[21,10],[21,12]] }
  };

  CanvasTextFunctions.letter = function(ch)
  {
    return CanvasTextFunctions.letters[ch];
  }

  CanvasTextFunctions.ascent = function(font, size)
  {
    return size;
  }

  CanvasTextFunctions.descent = function(font, size)
  {
    return 7.0*size/25.0;
  }

  CanvasTextFunctions.measure = function(font, size, str)
  {
    var total = 0;
    var len = str.length;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (c)
        total += c.width * size / 25.0;
    }

    return total;
  }

  CanvasTextFunctions.draw = function(ctx, font, size, x, y, str)
  {
    var total = 0;
    var len = str.length;
    var mag = size / 25.0;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 2.0 * mag;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (!c) continue;

    	ctx.beginPath();

    	var penUp = 1;
    	var needStroke = 0;
    	for (j = 0; j < c.points.length; j++)
      {
    	  var a = c.points[j];
    	  if (a[0] == -1 && a[1] == -1)
        {
      		penUp = 1;
      		continue;
    	  }
    	  if (penUp)
        {
      		ctx.moveTo(x + a[0]*mag, y - a[1]*mag);
      		penUp = false;
    	  }
        else
        {
    		  ctx.lineTo(x + a[0]*mag, y - a[1]*mag);
    	  }
    	}
    	ctx.stroke();
    	x += c.width*mag;
    }
    ctx.restore();
    return total;
  }

// simple add event handler that gets the handlers called in the sequene that they were set
  function addLoadEvent(obj, func)
  {
  	var oldonload = obj.onload;

  	if (typeof obj.onload != 'function')
      obj.onload = func;
  	else
    	obj.onload = function(){oldonload();	func();}
  }

/**
 * A class to parse color values
 * @author Stoyan Stefanov <sstoo@gmail.com>
 * @link   http://www.phpied.com/rgb-color-parser-in-javascript/
 * @license Use it if you like it
 *
 * supplemented to handle rgba format (alpha 0 .. 1.0)  by arc 04SEP09
 */
function RGBAColor(color_string)
{
    this.ok = false;

    if (typeof color_string != "string")       // bugfix: crashed if passed a number. arc
      return;

    // strip any leading #
    if (color_string.charAt(0) == '#') { // remove # if any
        color_string = color_string.substr(1,6);
    }

    color_string = color_string.replace(/ /g,'');
    color_string = color_string.toLowerCase();

    // before getting into regexps, try simple matches
    // and overwrite the input
    var simple_colors = {
        aliceblue: 'f0f8ff',
        antiquewhite: 'faebd7',
        aqua: '00ffff',
        aquamarine: '7fffd4',
        azure: 'f0ffff',
        beige: 'f5f5dc',
        bisque: 'ffe4c4',
        black: '000000',
        blanchedalmond: 'ffebcd',
        blue: '0000ff',
        blueviolet: '8a2be2',
        brown: 'a52a2a',
        burlywood: 'deb887',
        cadetblue: '5f9ea0',
        chartreuse: '7fff00',
        chocolate: 'd2691e',
        coral: 'ff7f50',
        cornflowerblue: '6495ed',
        cornsilk: 'fff8dc',
        crimson: 'dc143c',
        cyan: '00ffff',
        darkblue: '00008b',
        darkcyan: '008b8b',
        darkgoldenrod: 'b8860b',
        darkgray: 'a9a9a9',
        darkgreen: '006400',
        darkkhaki: 'bdb76b',
        darkmagenta: '8b008b',
        darkolivegreen: '556b2f',
        darkorange: 'ff8c00',
        darkorchid: '9932cc',
        darkred: '8b0000',
        darksalmon: 'e9967a',
        darkseagreen: '8fbc8f',
        darkslateblue: '483d8b',
        darkslategray: '2f4f4f',
        darkturquoise: '00ced1',
        darkviolet: '9400d3',
        deeppink: 'ff1493',
        deepskyblue: '00bfff',
        dimgray: '696969',
        dodgerblue: '1e90ff',
        feldspar: 'd19275',
        firebrick: 'b22222',
        floralwhite: 'fffaf0',
        forestgreen: '228b22',
        fuchsia: 'ff00ff',
        gainsboro: 'dcdcdc',
        ghostwhite: 'f8f8ff',
        gold: 'ffd700',
        goldenrod: 'daa520',
        gray: '808080',
        green: '008000',
        greenyellow: 'adff2f',
        honeydew: 'f0fff0',
        hotpink: 'ff69b4',
        indianred : 'cd5c5c',
        indigo : '4b0082',
        ivory: 'fffff0',
        khaki: 'f0e68c',
        lavender: 'e6e6fa',
        lavenderblush: 'fff0f5',
        lawngreen: '7cfc00',
        lemonchiffon: 'fffacd',
        lightblue: 'add8e6',
        lightcoral: 'f08080',
        lightcyan: 'e0ffff',
        lightgoldenrodyellow: 'fafad2',
        lightgrey: 'd3d3d3',
        lightgreen: '90ee90',
        lightpink: 'ffb6c1',
        lightsalmon: 'ffa07a',
        lightseagreen: '20b2aa',
        lightskyblue: '87cefa',
        lightslateblue: '8470ff',
        lightslategray: '778899',
        lightsteelblue: 'b0c4de',
        lightyellow: 'ffffe0',
        lime: '00ff00',
        limegreen: '32cd32',
        linen: 'faf0e6',
        magenta: 'ff00ff',
        maroon: '800000',
        mediumaquamarine: '66cdaa',
        mediumblue: '0000cd',
        mediumorchid: 'ba55d3',
        mediumpurple: '9370d8',
        mediumseagreen: '3cb371',
        mediumslateblue: '7b68ee',
        mediumspringgreen: '00fa9a',
        mediumturquoise: '48d1cc',
        mediumvioletred: 'c71585',
        midnightblue: '191970',
        mintcream: 'f5fffa',
        mistyrose: 'ffe4e1',
        moccasin: 'ffe4b5',
        navajowhite: 'ffdead',
        navy: '000080',
        oldlace: 'fdf5e6',
        olive: '808000',
        olivedrab: '6b8e23',
        orange: 'ffa500',
        orangered: 'ff4500',
        orchid: 'da70d6',
        palegoldenrod: 'eee8aa',
        palegreen: '98fb98',
        paleturquoise: 'afeeee',
        palevioletred: 'd87093',
        papayawhip: 'ffefd5',
        peachpuff: 'ffdab9',
        peru: 'cd853f',
        pink: 'ffc0cb',
        plum: 'dda0dd',
        powderblue: 'b0e0e6',
        purple: '800080',
        red: 'ff0000',
        rosybrown: 'bc8f8f',
        royalblue: '4169e1',
        saddlebrown: '8b4513',
        salmon: 'fa8072',
        sandybrown: 'f4a460',
        seagreen: '2e8b57',
        seashell: 'fff5ee',
        sienna: 'a0522d',
        silver: 'c0c0c0',
        skyblue: '87ceeb',
        slateblue: '6a5acd',
        slategray: '708090',
        snow: 'fffafa',
        springgreen: '00ff7f',
        steelblue: '4682b4',
        tan: 'd2b48c',
        teal: '008080',
        thistle: 'd8bfd8',
        tomato: 'ff6347',
        turquoise: '40e0d0',
        violet: 'ee82ee',
        violetred: 'd02090',
        wheat: 'f5deb3',
        white: 'ffffff',
        whitesmoke: 'f5f5f5',
        yellow: 'ffff00',
        yellowgreen: '9acd32'
    };
    for (var key in simple_colors) {
        if (color_string == key) {
            color_string = simple_colors[key];
        }
    }
    // emd of simple type-in colors

    // array of color definition objects
    var color_defs = [
        {
            re: /^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*((1(\.0)?)|0?(\.\d*)?)\)$/,
            example: ['rgba(123, 234, 45, 0.5)', 'rgba(255,234,245,1)'],
            process: function (bits){
                return [
                    parseInt(bits[1]),
                    parseInt(bits[2]),
                    parseInt(bits[3]),
                    parseFloat(bits[4])
                ];
            }
        },
        {
            re: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
            example: ['rgb(123, 234, 45)', 'rgb(255,234,245)'],
            process: function (bits){
                return [
                    parseInt(bits[1]),
                    parseInt(bits[2]),
                    parseInt(bits[3])
                ];
            }
        },
        {
            re: /^(\w{2})(\w{2})(\w{2})$/,
            example: ['#00ff00', '336699'],
            process: function (bits){
                return [
                    parseInt(bits[1], 16),
                    parseInt(bits[2], 16),
                    parseInt(bits[3], 16)
                ];
            }
        },
        {
            re: /^(\w{1})(\w{1})(\w{1})$/,
            example: ['#fb0', 'f0f'],
            process: function (bits){
                return [
                    parseInt(bits[1] + bits[1], 16),
                    parseInt(bits[2] + bits[2], 16),
                    parseInt(bits[3] + bits[3], 16)
                ];
            }
        }
    ];

    // search through the definitions to find a match
    for (var i = 0; i < color_defs.length; i++) {
        var re = color_defs[i].re;
        var processor = color_defs[i].process;
        var bits = re.exec(color_string);
        if (bits) {
            var channels = processor(bits);    // bugfix: was global. [ARC 17Jul12]
            this.r = channels[0];
            this.g = channels[1];
            this.b = channels[2];
            if (bits.length>3)
              this.a = channels[3];
            else
              this.a = 1.0;
            this.ok = true;
        }

    }

    // validate/cleanup values
    this.r = (this.r < 0 || isNaN(this.r)) ? 0 : ((this.r > 255) ? 255 : this.r);
    this.g = (this.g < 0 || isNaN(this.g)) ? 0 : ((this.g > 255) ? 255 : this.g);
    this.b = (this.b < 0 || isNaN(this.b)) ? 0 : ((this.b > 255) ? 255 : this.b);
    this.a = (this.a < 0 || isNaN(this.a)) ? 1.0 : ((this.a > 1) ? 1.0 : this.a);

    // some getters
    this.toRGBA = function () {
        return 'rgba(' + this.r + ', ' + this.g + ', '  + this.b + ', ' + this.a + ')';
    }
    this.toRGB = function () {
        return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
    }
    this.toHex = function () {
        var r = this.r.toString(16);
        var g = this.g.toString(16);
        var b = this.b.toString(16);
        if (r.length == 1) r = '0' + r;
        if (g.length == 1) g = '0' + g;
        if (b.length == 1) b = '0' + b;
        return '#' + r + g + b;
    }
}

