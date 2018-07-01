'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var toString = Object.prototype.toString;

var Action = function () {
  function Action(name) {
    var payload = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Object.create(null);
    var context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Object.create(null);
    var method = arguments[3];

    _classCallCheck(this, Action);

    var t = this;

    if (!name || typeof name !== 'string') {
      throw new Error('the first parameter must be a string identifier');
    }

    t.name = name;

    if (payload) {
      t.payload = payload;
    }

    t.context = context;
  }

  _createClass(Action, [{
    key: 'Is',
    value: function Is(name) {
      return name === this.name;
    }
  }]);

  return Action;
}();

Action.DEFAULT = 'action.default';
exports.default = Action;
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Reducer = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _pathToRegexp = require('path-to-regexp');

var _pathToRegexp2 = _interopRequireDefault(_pathToRegexp);

var _emitter = require('@freshlysqueezedgames/emitter');

var _emitter2 = _interopRequireDefault(_emitter);

var _Action = require('./Action');

var _Action2 = _interopRequireDefault(_Action);

var _Reducer = require('./Reducer');

var _Reducer2 = _interopRequireDefault(_Reducer);

var _Route = require('./Route');

var _Route2 = _interopRequireDefault(_Route);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _Object$prototype = Object.prototype,
    toString = _Object$prototype.toString,
    hasOwnProperty = _Object$prototype.hasOwnProperty;

var instances = {};

/**
 * #TODO: Replace socket.io with websockets (5x faster)
 * #TODO: Get subscriptions being triggered by submitted actions
 * #TODO: Have update stage (triggered by function call) with resulting full-sweep update
 * #TOOD: Allow for a general UPDATE action on all reducers, allowing for specific branches to update based on server triggers
 * @param {*} props 
 */
function Hermes(props) {
  if (!props || !props.name) {
    throw new Error('all Hermes instances must have a unique name ({name : [YOUR NAME]}) to be able to recover them globally');
  }

  var instance = void 0;

  var HERMES_EVENTS = {
    UPDATE: 'hermesevents.update'

    // Each hermes instance has a private store that is used to manage a state heap.
  };var Store = Object.create(null);

  /**
   * Stores path information in a searchable heap
   */
  var paths = Object.create(null);
  var pathEnds = []; // We can more efficiently trace paths by working from the leaves to the root

  var reducers = Object.create(null);
  var reducerEnds = [];

  var reducer = new _Reducer2.default();

  var events = [];
  var callbacks = Object.create(null);

  var context = "";

  var Events = function () {
    function Events() {
      _classCallCheck(this, Events);
    }

    _createClass(Events, null, [{
      key: 'AddEvent',
      value: function AddEvent(name, payload) {
        events.push({ name: name, payload: payload, context: context });
      }

      /**
       * Set Context In Hermes is a means of determining the path that may have lead to the change. Reducers
       * are re-usable, and we need to be able to trigger events in a certain context.
       * @param {*} name 
       */

    }, {
      key: 'SetContext',
      value: function SetContext(name) {
        context = name;
      }

      /**
       * @name Subscribe
       * @description This is used to set the callbacks on what is available.
       * @param {*} name 
       * @param {*} callback 
       */

    }, {
      key: 'Subscribe',
      value: function Subscribe(name, callback, projection) {
        var list = callbacks[name] = callbacks[name] || []; // create a new array if there isn't one

        callback.projection = projection;

        list.push(callback);
      }
    }, {
      key: 'Dispatch',
      value: function Dispatch() {
        var i = -1;
        var event = void 0;

        while (event = events[++i]) {
          if (!callbacks[event.name]) {
            continue;
          }

          var list = callbacks[event.name];

          var j = -1;
          var _callback = void 0;

          while (_callback = list[++j]) {
            var content = Object.create(null);

            if (_callback.projection) {
              for (var key in _callback.projection) {
                var item = _callback.projection[key];
                var target = event.payload;
                var _i = 0;
                var l = item.length;

                while ((target = target[item[_i++]]) && _i < l) {}

                content[key] = target;
              }
            } else {
              content = event;
            }

            if (_callback(content, event.context)) {
              list.splice(j--, 1);
            }
          }
        }

        events = [];
      }
    }]);

    return Events;
  }();

  reducer.Events = function () {
    return Events;
  };

  /** 
   * @class Hermes
   * @description This singleton manages stores in the context of a external data source and marries the paths not only to the urls for the server,
   * but for the object traversal itself. Making it possible to listen for changes to data at any specific point in a heap. As any flux design, actions
   * trigger changes in the Store (including from the server) and views can subscribe to object changes in the heap(s)
  */

  var Hermes = function () {
    function Hermes(props) {
      _classCallCheck(this, Hermes);

      if (instance) {
        throw new Error('Hermes already exists, please use Hermes.Instance() to get the singleton');
      }

      if (props.paths) {
        props.paths = OrderByLongest(props.paths);

        for (var key in props.paths) {
          var config = new _Route2.default(key, props.paths[key]);

          var current = Branch(paths, key.split('/'), function (node, step, i) {
            node.step = step;
            node.position = i + 1;

            return node;
          }, true);

          pathEnds.push(current);
          current.config = config;
        }
      } else if (props.verbose) {
        console.warn('No paths have been defined for the instance: ', props.name, 'this means no data will be pulled from the server');
      }

      if (props.reducers) {
        props.reducers = OrderByLongest(props.reducers);

        for (var _key in props.reducers) {
          var _reducer = props.reducers[_key];

          if (!(_reducer instanceof _Reducer2.default)) {
            throw new Error('Property at path: ', _key, ' is not a Reducer instance!');
          }

          // Bind a function for accessing the events list. There is one list per Hermes.
          _reducer.Events = function () {
            return Events;
          };

          var _current = Branch(reducers, _key.split('/'), function (node, step, i) {
            node.step = step;
            node.position = i + 1;

            return node;
          }, true);

          reducerEnds.push(_current);

          _current.reducer = _reducer;
          _reducer.path = _key;
        }
      } else if (props.verbose) {
        console.warn('No reducers have been defined for the instance, this means all data will be copied as submitted in action payloads: ', props.name);
      }

      var t = this;

      t.verbose = props.verbose || false;
      t.paths = props.paths || false;
    }

    _createClass(Hermes, [{
      key: 'Subscribe',
      value: function Subscribe(name, callback, projection) {
        var t = this;

        if (!name || typeof name !== 'string' || toString.call(callback) !== '[object Function]') {
          console.warn('you must always call Subscribe with a string path and a callback function', name, callback);
          return t;
        }

        // if (!subscriptions[path]) { // TODO: This needs to be a callback, promises are done once resolve is called.
        //   const group : Array = subscriptions[path] = []

        //   group.keys = []
        //   group.regex = pathToRegexp(path, group.keys)
        //   group.ToPath = pathToRegexp.compile(path)
        // }

        for (var key in projection) {
          projection[key] = projection[key].split('/');
        }

        Events.Subscribe(name, callback, projection);

        return t;
      }
    }, {
      key: 'Do',
      value: function Do(action) {
        var t = this;

        if (!(action instanceof _Action2.default)) {
          throw new Error('Parameter 1 must be an Action instance', action);
        }

        // We look at the instance, and determine our path based on the reducer instance associated with the action
        var i = reducerEnds.length;
        var path = void 0;
        var reducer = action.Reducer();

        // Match the reducer
        while (i--) {
          var reducerEnd = reducerEnds[i].reducer;

          if (reducer === reducerEnd) {
            path = reducerEnd.path;

            // notify reducer of submission
            reducerEnd.Submission(action);
            break;
          }
        }

        // one time call for the first request of the data
        return Query.call(t, _pathToRegexp2.default.compile(path)(action.context), action);
      }
    }, {
      key: 'Print',
      value: function Print() {
        console.log('this is the store', Store);
      }
    }], [{
      key: 'Instance',
      value: function Instance(props) {
        return instance || new Hermes(props);
      }
    }]);

    return Hermes;
  }();

  /**
   * This looks at the paths and determines which is the closest match, working from 
   * the leaves downwards
   * @param {*} steps 
   */


  function Trace(steps) {
    var ends = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : pathEnds;

    var t = this;

    var i = -1;
    var l = ends.length;

    var requestPath = void 0;
    var closestPath = void 0;

    var result = void 0;

    while (++i < l) {
      var end = ends[i];

      if (end.position !== steps.length) {
        // the path must be the same length
        continue;
      }

      var j = steps.length;

      while (j--) {
        var step = steps[j];

        if (end.position === j + 1 && end.step !== step && end.step[0] !== ':') {
          break;
        }

        if (end.position === j + 1) {
          end = end.parent;
        }
      }

      if (j === -1) {
        end = ends[i];

        result = end;
        closestPath = [end.step];

        while ((end = end.parent) && end.step) {
          closestPath.unshift(end.step);
        }

        requestPath = steps.slice(0, closestPath.length);

        break;
      }
    }

    return {
      requestPath: requestPath,
      result: result
    };
  }

  function Query(path, action) {
    var t = this;

    if (t.verbose) {
      console.log('getting this path!', path);
    }

    return new Promise(function (resolve, reject) {
      var steps = path.split('/');

      var _Trace$call = Trace.call(t, steps),
          requestPath = _Trace$call.requestPath,
          result = _Trace$call.result;

      var OnApply = function OnApply() {
        var payload = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Object.create(null);

        action.payload = payload; // Override the payload with the new one given

        // Update the store, and ensure that the new state is in place.
        Update.call(t, steps, action);

        // This part, working in parent-first left-to-right, we should trigger any subscribers at each path within the CHANGED heap.
        //Publish.call(t, steps, action)
        Events.Dispatch();

        resolve && resolve();
      };

      if (!requestPath) {
        // this is not a requestable piece of data!
        OnApply(action.payload);
        return;
      }

      steps.splice(requestPath.length);

      if (t.verbose) {
        console.log('requesting this path!', requestPath.join('/'));
      }

      // We need to be able to deviate here based on the type of request. Either it will follow a REST style system or GraphQL style system
      // http://127.0.0.1:3000/arc?query=%23%20Welcome%20to%20GraphiQL%0A%23%0A%23%20GraphiQL%20is%20an%20in-browser%20tool%20for%20writing%2C%20validating%2C%20and%0A%23%20testing%20GraphQL%20queries.%0A%23%0A%23%20Type%20queries%20into%20this%20side%20of%20the%20screen%2C%20and%20you%20will%20see%20intelligent%0A%23%20typeaheads%20aware%20of%20the%20current%20GraphQL%20type%20schema%20and%20live%20syntax%20and%0A%23%20validation%20errors%20highlighted%20within%20the%20text.%0A%23%0A%23%20GraphQL%20queries%20typically%20start%20with%20a%20%22%7B%22%20character.%20Lines%20that%20starts%0A%23%20with%20a%20%23%20are%20ignored.%0A%23%0A%23%20An%20example%20GraphQL%20query%20might%20look%20like%3A%0A%23%0A%23%20%20%20%20%20%7B%0A%23%20%20%20%20%20%20%20field(arg%3A%20%22value%22)%20%7B%0A%23%20%20%20%20%20%20%20%20%20subField%0A%23%20%20%20%20%20%20%20%7D%0A%23%20%20%20%20%20%7D%0A%23%0A%23%20Keyboard%20shortcuts%3A%0A%23%0A%23%20%20Prettify%20Query%3A%20%20Shift-Ctrl-P%20(or%20press%20the%20prettify%20button%20above)%0A%23%0A%23%20%20%20%20%20%20%20Run%20Query%3A%20%20Ctrl-Enter%20(or%20press%20the%20play%20button%20above)%0A%23%0A%23%20%20%20Auto%20Complete%3A%20%20Ctrl-Space%20(or%20just%20start%20typing)%0A%23%0A%0Aquery%20Scene%20(%24application%3AString%20%3D%20%22fiercesprout%22%2C%20%24scene%3AString%3D%22scene1%22)%7B%0A%20%20scene%20(application%3A%24application%2C%20scene%3A%24scene)%7B%0A%20%20%20%20title%0A%20%20%20%20world%20%7B%0A%20%20%20%20%20%20width%0A%20%20%20%20%20%20height%0A%20%20%20%20%20%20unit%0A%20%20%20%20%20%20minVertexX%0A%20%20%20%20%20%20minVertexY%0A%20%20%20%20%20%20maxVertexX%0A%20%20%20%20%20%20maxVertexY%0A%20%20%20%20%7D%0A%20%20%20%20layerDef%7B%0A%20%20%20%20%20%20target%0A%20%20%20%20%20%20worldObject%7B%0A%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20component%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D&operationName=Scene
      var request = new XMLHttpRequest();

      request.open('GET', './arc?query=' + encodeURIComponent(result.config.query));

      request.onload = function () {
        var payload = JSON.parse(request.response);

        if (payload.error) {
          console.log('there was an error associated with this request');
        }

        OnApply(_extends({}, action.payload, payload.data));
      };

      request.send();
    });
  }

  /**
   * #TODO: For each path on the subscription list, we need to update with the data from the change.
   * with ambiguous paths.
   * @param {*} steps 
   * @param {*} action 
   */
  function Update(steps, action) {
    var t = this;

    // we need to update the branch for the store where the path is concerned
    // no payload as this is just a path update
    var store = Branch(Store, steps, function (node, step, i) {
      var path = steps.slice(0, i + 1);

      var _Trace$call2 = Trace.call(t, path, reducerEnds, true),
          result = _Trace$call2.result; // look for an exact path match in the reducers


      var payload = i === steps.length - 1 ? action.payload : undefined;

      Events.SetContext(path.join('/'));

      if (!result || !result.reducer) {
        return reducer.Reduce(action, node, payload);
      }

      return result.reducer.Reduce(action, node, payload);
    });

    // then the returned heap needs to be updated (tree structure, no longer branch path)
    // payloads exist because we are now in the returned object heap. 
    Tree(store, action.payload, function (node, payload, keys) {
      var path = [].concat(_toConsumableArray(steps), _toConsumableArray(keys));

      var _Trace$call3 = Trace.call(t, path, reducerEnds, true),
          result = _Trace$call3.result; // look for an exact path match in the reducers

      Events.SetContext(path.join('/'));

      if (!result || !result.reducer) {
        return reducer.Reduce(action, node, payload);
      }

      return result.reducer.Reduce(action, node, payload);
    }, reducers);
  }

  function Tree(target, heap, onNode) {
    var keys = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

    if (toString.call(heap) === '[object Array]') {
      var i = -1;
      var member = void 0;

      while (member = heap[++i]) {
        var childKeys = [].concat(_toConsumableArray(keys), [i]);
        var typeString = toString.call(member);

        target[i] = Tree(onNode(target[i] || (typeString === '[object Array]' ? new Array(member.length) : Object.create(null)), member, childKeys), member, onNode, childKeys);
      }

      return target;
    }

    for (var key in heap) {
      var node = heap[key];
      var _typeString = toString.call(node);

      if (_typeString === '[object Object]' || _typeString === '[object Array]') {
        var _childKeys = [].concat(_toConsumableArray(keys), [key]);

        target[key] = Tree(onNode(target[key] || (_typeString === '[object Array]' ? new Array(node.length) : Object.create(null)), node, _childKeys), node, onNode, _childKeys);
      }
    }

    return target;
  }

  function Branch(target, steps, onNode) {
    var parenting = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    // our store needs to be updated with the values
    var i = -1;
    var l = steps.length;

    onNode = onNode || function (node) {
      return node;
    };

    while (++i < l) {
      var step = steps[i];

      if (!step) {
        continue;
      }

      target[step] = onNode(target[step] || Object.create(null), step, i);

      if (parenting) {
        target[step].parent = target;
      }

      target = target[step];
    }

    return target;
  }

  return instances[props.name] || (instances[props.name] = new Hermes(props));
}

/**
 * We map strings longest first so that we can ensure that the closest matches for paths is always found
 * @param {*} object 
 */
function OrderByLongest(object) {
  var keys = Object.keys(object);
  var orderedObject = Object.create(null);

  keys.sort(function (a, b) {
    if (a.length > b.length) {
      return -1;
    }

    if (b.length > a.length) {
      return 1;
    }

    return 0;
  });

  var i = -1;
  var l = keys.length;

  while (++i < l) {
    var key = keys[i];

    orderedObject[key] = object[key];
  }

  return orderedObject;
}

Hermes.Instance = function (name, props) {
  if (instances[name]) {
    return instances[name];
  }

  if (!props) {
    throw new Error('no instance exists under this name, you can create a new instance here but must provide properties as a second parameter');
  }

  props.name = name;

  return new Hermes(props);
};

exports.Reducer = _Reducer2.default;
exports.default = Hermes;
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Action2 = require('./Action');

var _Action3 = _interopRequireDefault(_Action2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var toString = Object.prototype.toString;


var id = 0;

var Reducer = function () {
  function Reducer(actions) {
    _classCallCheck(this, Reducer);

    var t = this;

    t.actions = actions || {};
    t.path = "";
    t.Events = null;

    t.id = id++;
  }

  /**
   * @name Submission
   * @description Callback for when an Action is submitted that affects the reducer. This can be used to dispatch events
   * triggering state updates within the UI (say you wish to notify the user of an impending update to information and want to display something to indicate such)
   * @param {Action} action The action submitted into the system. 
   */


  _createClass(Reducer, [{
    key: 'Submission',
    value: function Submission(action) {
      return this;
    }

    /**
     * @name Reduce
     * @description This is called when a payload is ready to be incorporated in the store heap. Before this happens, the Reducer can be overridden
     * so that the payload object is handled in the proper manner.
     * 
     * NOTE: If you have child reducers (reducers assigned to child addresses) of the store heap, there is no need to modify these at they are handled first and
     * will already have been affected.
     * @param {*} action 
     * @param {*} state 
     * @param {*} payload 
     */

  }, {
    key: 'Reduce',
    value: function Reduce(action) {
      var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Object.create(null);
      var payload = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Object.create(null);

      var t = this;

      if (toString.call(state) === '[object Array]') {
        if (state.length === payload.length) {
          [].concat(_toConsumableArray(state));
        }

        return [].concat(_toConsumableArray(payload));
      }

      return _extends({}, state, payload);
    }

    /**
     * @name Action
     * @description This is the way the system creates Actions. 
     * @param {*} name 
     * @param {*} payload 
     * @param {*} context 
     */

  }, {
    key: 'Action',
    value: function Action(name, payload, context) {
      var _this = this;

      var action = new _Action3.default(name, payload, context);

      action.Reducer = function () {
        return _this;
      };

      return action;
    }

    /**
     * @name Dispatch
     * @description Adds events to a list of events that gets triggered once the store has fully updated.
     * @param {String} eventName 
     * @param {Object} data 
     */

  }, {
    key: 'Dispatch',
    value: function Dispatch(eventName, data) {
      this.Events().AddEvent(eventName, data);
    }
  }]);

  return Reducer;
}();

Reducer.EVENTS = {
  CHANGE: 'reducer.change'
};
exports.default = Reducer;
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _pathToRegexp = require('path-to-regexp');

var _pathToRegexp2 = _interopRequireDefault(_pathToRegexp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class Route
 * @description Defines a point of communication across a network, where it should communicate with,
 * and how the request should behave in general.
 */
var Route = function Route(path, props) {
  _classCallCheck(this, Route);

  var t = this;

  if ((typeof props === 'undefined' ? 'undefined' : _typeof(props)) !== 'object') {
    props = Object.create(null);
  }

  t.ToPath = _pathToRegexp2.default.compile(path);
  t.re = (0, _pathToRegexp2.default)(path);

  if (props === true) {
    return;
  }

  t.query = props.query;

  if (props.literalPath) {
    t.literalPath = props.literalPath;
  }
};

exports.default = Route;
