(function(){
  var requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(callback, element){
                window.setTimeout(callback, 1000 / 60);
              };
  })();

  var EventManager = function( object ) {
    var listeners = [];

    this.dispatch = function( eventName, eventData ) {
      var theseListeners = listeners[ eventName ];
      if ( theseListeners ) {
        var event = {
          type: eventName,
          data: eventData
        };
        for ( var i=0, l=theseListeners.length; i<l; ++i ) {
          theseListeners[ i ]( event );
        } //for
      } //if
    }; //dispatch

    object.listen = function( eventName, listener ) {
      if ( !listeners[ eventName ] ) {
        listeners[ eventName ] = [];
      }
      listeners[ eventName ].push( listener );
    }; //listen

    object.unlisten = function( eventName, listener ) {
      var theseListeners = listeners[ eventName ];
      if ( theseListeners ) {
        if ( listener ) {
          var idx = theseListeners.indexOf( listener );
          if ( idx > -1 ) {
            theseListeners.splice( idx, 1 );
          } //if
        }
        else {
          listeners[ eventName ] = [];
        }
      } //if
    }; //unlisten
  }; //EventManager

  var NoProbalo = function( npOptions ) {

    var templateNode = document.getElementById( npOptions.template ),
        templateTitleClass = npOptions.templateTitle,
        templateBodyClass = npOptions.templateBody,
        nodeContainer = document.getElementById( npOptions.container ),
        nodeCanvas = document.getElementById( npOptions.canvas ),
        inputConnectionClassName = npOptions.inputConnectionClass,
        outputConnectionClassName = npOptions.outputConnectionClass,
        nodes = [],
        lines = [],
        otherConnection,
        np = this;

    var drawLoop;
    function startDrawLoop() {
      var ctx = nodeCanvas.getContext( "2d" );
      if (!drawLoop) {
        drawLoop = (function() {
          function loop() {
            if ( drawLoop ) {
              ctx.clearRect( 0, 0, nodeCanvas.width, nodeCanvas.height );
              ctx.strokeStyle = "#000";
              ctx.lineWidth = 1;
              ctx.beginPath();
              for ( var i=0, l=lines.length; i<l; ++i ) {
                lines[ i ].draw();
              } //for
              ctx.stroke();
              requestAnimFrame( loop, nodeCanvas );
            } //if
          } //loop
          return {
            start: function() {
              loop();
            },
            stop: function() {
              drawLoop = undefined;
            }
          };
        })();
        drawLoop.start();
      } //if
    } //startDrawLoop

    function stopDrawLoop() {
      drawLoop.stop();
    } //stopDrawLoop

    var Line = function( lineOptions ) {
      function Endpoint( inputX, inputY ) {
        var x, oldX, y, oldY;
        x = inputX || 0;
        oldX = x;
        y = inputY || 0;
        oldY = y;

        Object.defineProperty( this, "x", {
          get: function() { return x; },
          set: function( val ) { oldX = x; x = val; }
        });
        Object.defineProperty( this, "y", {
          get: function() { return y; },
          set: function( val ) { oldY = y; y = val; }
        });
      } //Endpoint

      var ctx = nodeCanvas.getContext( "2d" ),
          startEndpoint = new Endpoint( lineOptions.startX, lineOptions.startY ),
          endEndpoint = new Endpoint( lineOptions.startX, lineOptions.startY ),
          line = this;

      this.destroy = function() {
        var idx = lines.indexOf( line );
        if ( idx > -1 ) {
          lines.splice( idx, 1 );
        } //if
      }; //destroy

      this.draw = function() {
        ctx.moveTo( startEndpoint.x, startEndpoint.y );
        ctx.lineTo( endEndpoint.x, endEndpoint.y );
      }; //draw

      Object.defineProperty( this, "start", { get: function() { return startEndpoint; } } );
      Object.defineProperty( this, "end", { get: function() { return endEndpoint; } } );

      lines.push( line );
    }; //Line

    var Node = function( nodeOptions ) {

      var Connection = function( connectionOptions ) {
        var eventManager = new EventManager( this ),
            containerElement = document.createElement( "div" ),
            markerElement = document.createElement( "div" ),
            titleElement = document.createElement( "span" ),
            type = connectionOptions.type,
            connection = this,
            otherConnections = [],
            endpoints = [];

        if ( connectionOptions.events && connectionOptions.events.connect ) {
          connection.listen( "connectionconnected", connectionOptions.events.connect );
        } //if
        containerElement.className = connectionOptions.className;
        titleElement.innerHTML = connectionOptions.name;
        titleElement.className = connectionOptions.className + "-title";
        markerElement.className = connectionOptions.className + "-marker";
        containerElement.appendChild( markerElement );
        containerElement.appendChild( titleElement );

        Object.defineProperty( this, "owner", {
          get: function() { return node; }
        });

        Object.defineProperty( this, "element", {
          get: function() {
            return containerElement;
          }
        });

        Object.defineProperty( this, "type", {
          get: function() {
            return type;
          }
        });

        this.connectTo = function( other ) {
          otherConnections.push( other );
        }; //connectTo

        this.connectedTo = function( other ) {
          return otherConnections.indexOf( other ) > -1;
        }; //other

        this.update = function() {
          var rect = markerElement.getBoundingClientRect();
          for ( var i=0, l=endpoints.length; i<l; ++i ) {
            endpoints[ i ].x = rect.left + rect.width / 2;
            endpoints[ i ].y = rect.top + rect.height / 2;
          } //for
        } //update

        this.storeEndpoint = function( endpoint ) {
          endpoints.push( endpoint );
        }; //storeEndpoint

        function onMouseDown( e ) {
          var rect = markerElement.getBoundingClientRect();
          var line = new Line({
            startX: rect.left + rect.width / 2,
            startY: rect.top + rect.height / 2
          });

          otherConnection = undefined;

          function onMouseMove( e ) {
            line.end.x = e.clientX;
            line.end.y = e.clientY;
          } //onMouseMove

          function onMouseUp( e, noSave ) {
            window.removeEventListener( "mouseup", onMouseUp, false );
            window.removeEventListener( "mousemove", onMouseMove, false );
            window.removeEventListener( "keypress", onKeyPress, false );
            if ( noSave !== false ) {
              connection.storeEndpoint( line.start );
            } //if
            requestAnimFrame( stopDrawLoop, nodeCanvas );
            markerElement.addEventListener( "mouseover", onMouseOver, false );
            markerElement.addEventListener( "mouseout", onMouseOut, false );
            if (  otherConnection && 
                  otherConnection.owner !== node &&
                  otherConnection.type !== connection.type &&
                  !otherConnection.connectedTo( connection ) ) {
              otherConnection.storeEndpoint( line.end );
              otherConnection.connectTo( connection );
              connection.connectTo( otherConnection );
              eventManager.dispatch( "connectionconnected", {
                nput: otherConnection.type === "input" ? otherConnection : connection,
                output: otherConnection.type === "output" ? otherConnection : connection,
                start: connection,
                end: otherConnection
              });
            }
            else {
              line.destroy();
            } //if
            otherConnection = undefined;
          } //onMouseUp 
          function onKeyPress( e ) {
            if ( e.which === 0 ) {
              onMouseUp( e, false );
              line.destroy();
            } //if
          } //onKeyPress
          window.addEventListener( "mousemove", onMouseMove, false );
          window.addEventListener( "mouseup", onMouseUp, false );
          window.addEventListener( "keypress", onKeyPress, false );

          startDrawLoop();
          markerElement.removeEventListener( "mouseover", onMouseOver, false );
          markerElement.removeEventListener( "mouseout", onMouseOut, false );
          eventManager.dispatch( "connectionstarted" );
        } //onMouseDown

        function onMouseOver( e ) {
          otherConnection = connection;
        } //onMouseDown

        function onMouseOut( e ) {
          otherConnection = undefined;
        } //onMouseOut

        this.destroy = function() {
          markerElement.removeEventListener( "mousedown", onMouseDown, false );
          markerElement.removeEventListener( "mouseover", onMouseOver, false );
          markerElement.removeEventListener( "mouseout", onMouseOut, false );
        }; //destroy

        markerElement.addEventListener( "mousedown", onMouseDown, false );
        markerElement.addEventListener( "mouseover", onMouseOver, false );
        markerElement.addEventListener( "mouseout", onMouseOut, false );
      }; //Connection

      var id = nodes.length,
          xPos = 0,
          yPos = 0,
          locked = false,
          title,
          connections = [],
          inputConnections = {},
          outputConnections = {},
          eventManager = new EventManager( this ),
          numInputs = 0,
          numOutputs = 0,
          node = this;

      var nodeElement = templateNode.cloneNode( true ),
          titleElement = nodeElement.getElementsByClassName( templateTitleClass )[ 0 ],
          bodyElement = nodeElement.getElementsByClassName( templateBodyClass )[ 0 ];

      titleElement.id = "noprobalo-node-title-" + id;

      nodeElement.id = "noprobalo-node-" + id;

      var width = nodeElement.getBoundingClientRect().width,
          height = nodeElement.getBoundingClientRect().height;

      function onTitleMouseDown( e ) {
        var startRect = nodeElement.getBoundingClientRect();
        var mouseDiff = [
              e.clientX - startRect.left,
              e.clientY - startRect.top
            ];
        function onMouseMove( e ) {
          node.x = e.clientX - mouseDiff[ 0 ];
          node.y = e.clientY - mouseDiff[ 1 ];
          for ( var i=0, l=connections.length; i<l; ++i ) {
            connections[ i ].update();
          } //for
        } //onMouseMove
        function onMouseUp( e ) {
          window.removeEventListener( "mousemove", onMouseMove, false );
          window.removeEventListener( "mouseup", onMouseUp, false );
          window.removeEventListener( "keypress", onKeyPress, false );
          stopDrawLoop();
        } //onMouseUp
        function onKeyPress( e ) {
          if ( e.which === 0 ) {
            node.x = startRect.left;
            node.y = startRect.top;
            onMouseUp();
          } //if
        } //onKeyPress
        window.addEventListener( "mousemove", onMouseMove, false );
        window.addEventListener( "mouseup", onMouseUp, false );
        window.addEventListener( "keypress", onKeyPress, false );
        startDrawLoop();
      } //onTitleMouseDown

      this.destroy = function() {
        titleElement.removeEventListener( "mousedown", onTitleMouseDown, false );
      }; //destroy

      Object.defineProperty( this, "locked", {
        set: function( val ) {
          if ( val ) {
            titleElement.removeEventListener( "mousedown", onTitleMouseDown, false );
          }
          else {
            titleElement.addEventListener( "mousedown", onTitleMouseDown, false );
          }
        },
        get: function() {
          return locked;
        }
      });

      Object.defineProperty( this, "x", {
        set: function( val ) { 
          if ( val !== undefined ) {
            xPos = val;
            nodeElement.style.left = xPos + "px";
          }
        },
        get: function() {
          return xPos;
        }
      });

      Object.defineProperty( this, "y", {
        set: function( val ) { 
          if ( val !== undefined ) {
            yPos = val;
            nodeElement.style.top = yPos + "px";
          }
        },
        get: function() {
          return yPos;
        }
      });

      Object.defineProperty( this, "title", {
        get: function() {
          return title;
        },
        set: function( val ) {
          title = val;
          titleElement.innerHTML = val;
        }
      });

      Object.defineProperty( this, "id", {
        get: function() {
          return id;
        }
      });

      function placeConnections() {
        var rect = nodeElement.getBoundingClientRect(),
            inputSpacing = rect.height / numInputs,
            outputSpacing = rect.height / numOutputs,
            i;
        i=0;
        for ( var connectionName in inputConnections ) {
          if ( inputConnections.hasOwnProperty( connectionName ) ) {
            var connection = inputConnections[ connectionName ],
                element = connection.element;
            if ( !connection.element.parentNode ) {
              nodeElement.appendChild( element );
              element.style.left = "-5px";
            } //if
            element.style.top = ( inputSpacing * i + ( inputSpacing / 2.5 ) ) + "px";
            ++i;
          } //if
        } //for
        i=0;
        for ( var connectionName in outputConnections ) {
          if ( outputConnections.hasOwnProperty( connectionName ) ) {
            var connection = outputConnections[ connectionName ],
                element = connection.element;
            if ( !connection.element.parentNode ) {
              nodeElement.appendChild( element );
              element.style.right = "-5px";
            } //if
            element.style.top = ( outputSpacing * i + ( outputSpacing / 1.5 ) ) + "px";
            ++i;
          } //if
        } //for
      } //placeConnections

      var addConnection = this.addConnection = function( type, name, connectionOptions ) {
        if ( type && name ) {
          if ( type === "input" ) {
            ++numInputs;
            inputConnections[ name ] = new Connection({
              name: name,
              className: inputConnectionClassName,
              events: connectionOptions,
              type: type
            });
            connections.push( inputConnections[ name ] );
            placeConnections();
          }
          else if ( type === "output" ) {
            ++numOutputs;
            outputConnections[ name ] = new Connection({
              name: name,
              className: outputConnectionClassName,
              events: connectionOptions,
              type: type
            });
            connections.push( outputConnections[ name ] );
            placeConnections();
          } //if
        } //if
      }; //addConnection

      var getConnection = this.getConnection = function( type, name ) {
        if ( type && name ) {
          if ( type === "input" ) {
            return inputConnections[ name ];
          }
          else if ( type === "output" ) {
            return outputConnections[ name ];
          } //if
        } //if
      }; //getConnection

      var removeConnection = this.removeConnection = function( type, name ) {
        var connection;
        if ( type && name ) {
          if ( type === "input" ) {
            connection = inputConnections[ name ];
            if ( connection ) {
              --numInputs;
              connection.destroy();
              delete inputConnections[ name ];
              connections.splice( connections.indexOf( connection ), 1 );
            }
          }
          else if ( type === "output" ) {
            connection = outputConnections[ name ];
            if ( connection ) {
              --numOutputs;
              connection.destroy();
              delete outputConnections[ name ];
              connections.splice( connections.indexOf( connection ), 1 );
            }
          } //if
        } //if

      }; //removeConnection

      nodeContainer.appendChild( nodeElement );
      node.x = nodeOptions.position[ 0 ];
      node.y = nodeOptions.position[ 1 ];
      node.locked = nodeOptions.locked;
      node.title = nodeOptions.title || "Node" + id;

      if ( nodeOptions.inputs ) {
        for ( var inputName in nodeOptions.inputs ) {
          if ( nodeOptions.inputs.hasOwnProperty( inputName ) ) {
            node.addConnection( "input", inputName, nodeOptions.inputs[ inputName ] );
          } //if
        } //for
      } //if
      if ( nodeOptions.outputs ) {
        for ( var outputName in nodeOptions.outputs ) {
          if ( nodeOptions.outputs.hasOwnProperty( outputName ) ) {
            node.addConnection( "output", outputName, nodeOptions.outputs[ outputName ] );
          } //if
        } //for
      } //if

    }; //Node

    this.createNode = function( nodeOptions ) {
      var n = new Node( nodeOptions );
      nodes.push( n );
      return n;
    }; //createNode

    this.removeNode = function( node ) {
      var idx = nodes.indexOf( node );
      if ( idx > -1 ) {
        nodes.splice( idx, 1 );
        node.destroy();
      } //if
    }; //removeNode

    Object.defineProperty( this, "numNodes", { get: function() { return nodes.length; } } );

    if ( templateNode.parentNode ) {
      templateNode.parentNode.removeChild( templateNode );
    } //if

  }; //NoProbalo

  window.NoProbalo = function( options ) {
    return new NoProbalo( options );
  };
})();
