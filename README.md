# Hermes
## Path Based State Management System

Hermes is an alternative to other flux implementations that uses paths as addresses to locations in state data. It aims to reduce your coding overhead by dynamically creating your state tree from data payloads and path routes, and uses default reducers for Arrays and Objects without you having to explicitly define reducers for every node in the state heap.

It should also be encapsulated enough that using with any DOM Rendering Framework should be intuitive and easy.

It has one dependency : the [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module, which has a handy syntax for writing generalised path syntax, 
you can play around with [testing different paths here](https://forbeslindesay.github.io/express-route-tester/).

** Currently In Development, Not Fully Featured as of Yet **

## Quickstart

If you just want to get into using this straight away...

### Make A Reducer

Create your reducers like so : 

```javascript
class MyReducer extends Reducer {
  static ACTIONS : Object = { // Setup an index of actions
    CHANGE : 'myreducer.change'
  }
  
  static EVENTS : Object = { // Also an index of events
    CHANGE : 'myreducer.change'
  }

  // Overwrite the Reducer function, which accepts the action, the state and the payload
  Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {  
    this.Dispatch(MyReducer.EVENTS.CHANGE) // dispatch your event, which will be passed to listening subscribers

    return {...state, ...payload}
  }

  Change (payload : Object) { // Create functions that invoke actions. Actions are created with the reducers base class and must be built this way.
    return this.Action(MyReducer.ACTIONS.CHANGE, payload)
  }
}

```

### Create a Hermes Store

And pass them to your Hermes instance like so:

```javascript 

const myReducer : MyReducer = new MyReducer

const store : Hermes = new Hermes({
  reducers : {
    'my/path' : myReducer
  }
})

store.Subscribe(MyReducer.EVENTS.CHANGE, (event : Object) => {
  const {payload, context} = event

  console.log(payload) // {some : 'data'}
  console.log(context) // {path : 'path'}
}, 'my/:path')

store.Do(myReducer.Change({some : 'data'}))

```
### Describe Your Actions

Actions must be created via the Action function on the Reducer baseclass. It is recommended to create functions that call this internally like so:

```javascript
class MyReducer {
  ...

  // path is test/:index
  Change (data1 : string, data2 : string, index : number) : Hermes.Action {
    return this.Action(MyReducer.ACTION.SOMETHING, {data1, data2}, {index})
  }

  ...
}
```

Creating an action takes a name, a payload object, and a context, if your path is literal (as in does not have ambigous parts to it) then you can leave this empty. Similarly, a payload is not required.

### Hook In A Network Callback

To integrate network communication, you can use a remote configuration, like so:

```javascript

const store : Hermes = new Hermes({
  reducers : {
    'my/path' : myReducer
  },
  remote : {
    paths : [
      'my/path' // list paths that a request to a remote server is used for
    ],
    request : (path : string, action : Hermes.Action, state : Object, resolve : Function) => {
      if (action.name === 'some.name') {
        ... // make a request

        resolve({your : 'payload'}) // return an object containing state data
        return
      }

      return false // returning false indicates no request is needed
    }
  }
})

```
### Important Notes

1. Reducers must be unique instances at each route (even between different stores)
2. An initialize action sometimes happens with reducers if Hermes needs to determines whether state is expected to be an array or object. Events triggered on this pass will be ignored by the system.
3. Any path-to-regexp expression can be used, and the context object on the action will have the parsed keys.
4. More than one reducer can match a particular path, and they will all be called in the order they were declared to Hermes
5. Returned event state is the culmination of all matching reducers for an action path, regardless of when they are triggered
6. You Subscribe to events, not actions
7. You can declare as many events as you like inside your reducers

## Hermes Class

Hermes acts as your container for a state heap (store), you can have as many or as few as you want, the only caveat is whereever you decide to manage your store should be a wrapper in a way so as to be exposed singularly to the rendering framework heap. You can achieve this as follows, but you may have your own pattern you like to follow:

| Function | Signature | Returns | Description |
| -------- | --------- | ------- | ----------- |
| Subscribe | name: string, callback: Function, path? : string, projection?: Object | Hermes | This function subscribes to events on a particular reducer. |
| Unsubscribe | name : string, callback? : Function | Hermes | This allows you to remove a subscription to an event
| Do        | action: Action, path? : string | Promise | Launches an action on the state heap, resolves when complete |
| GetState | | Object | Returns the current state of the application
| Print | | Hermes | console logs your current state heap.

```javascript

  import Hermes from '@freshlysqueezedgames/hermes'

  let store : Store
  let instance : YourManagementClass

  class YourManagementClass {
    constructor (props? : Object) {
      super(props)

      if (instance) {
        throw new Error('An instance of YourManagementClass already exists, please use YourManagementClass.Instance')
      }

      const t : YourManagementClass = this

      store = new Hermes({
        // [...paths]
        // [...reducers]
      })

      instance = t
    }

    static Instance (props? : Object) {
      return instance || new YourManagementClass(props)
    }

    // ...
  }

```
What Hermes attempts to achieve is to turn your state heap into a set of addresses that have urls same as any webpage: 

```javascript 
  
  const structure : Object = {
    a : {
      b : {
        c : {}
      }
    }
  }

  const addressToC : string = 'a/b/c' // this path would generate the above

```

### Subscribe

You can subscribe to events at particular addresses by using the Subscribe function: 

```javascript

  store.Subscribe(YourReducer.EVENTS.CHANGE, (payload : Object) => {
    console.log(payload) // {c : 'foo'}
  }, 'a/b')

```

You can use ambiguous paths to subscribe to events in particular 'domains' - say for example, your had an array at b and wanted
to be notified of changes to any member

Explicit Address would be:

```javascript 

const structure : Object = {
  a : {
    b : [{
      c : 'foo'
    }]
  }
}

store.Subscribe(..., ..., 'a/b/0/c')

```

If you wanted ANY member, your would just pass an ambiguous term like so:

```javascript

store.Subscribe(..., ..., 'a/b/:index/c')

```
When you recieved the event back, you can use the context Object to deviate behaviour based on the index if necessary:

```javascript

store.Subscribe(..., (event : Object) => {
  const {payload, context} = event

  if (context.index === 0) {
    // do something
  }

}, 'a/b/:index/c')

```

### Unsubscribe

You can unsubscribe to events using this function, simply state the name of the event you want to unsubscribe to, and the original event you want to unsubscribe from.

```javascript

  store.Unsubcribe(MyReducer.EVENTS.CHANGE, mylistener) // removes just this function.

```

If you want to unsubscribe from the event in it's entirety, just pass in the event name

```javascript
  
  store.Unsubcribe(MyReducer.EVENTS.CHANGE) // remove all

```

### Do

You invoke an action using the Do method, and must pass it an action that has been created via your reducer:

```javascript

store.Do(myReducer.MyAction({some : data}))

```

Actions are always created via your reducer. See Reducer section

Alternatively, in some situations where the application may have to explicitly decide the path, in which case you can include that as a secondary paramter. Just remember, a context will be needed for the action if any ambiguity is left to the path.

```javascript

store.Do(myReducer.MyAction({some : data}), 'target/path')

```

When passing your Reducers to Hermes, remember that a reducer at any path must be unique, as this helps to improve lookup considerably. Hermes will throw if you attempt to use an instance
twice, even across multiple Hermes instances

```javascript

const myReducer : MyReducer = new MyReducer

const store : Hermes = new Hermes({
  reducers : {
    'my/path' : myReducer
  }
})

store.Do(myReducer.MyAction({some : 'data'}))

```

the above is the minimum setup for hermes to work, here we have created a store with the following heap:

```javascript

const heap : Object = {
  my : {
    path : {}
  }
}

```

The instance of MyReducer will take the action payload, and apply it to the heap, assuming it just applies the payload to the state:

```javascript

const heap : Object = {
  my : {
    path : {
      some : 'data'
    }
  }
}

```

In terms of network communication, Hermes should have no responsibility / dictation over how you choose to communicate with your external data sources. For this reason
it simply provides a way to hook in requests based on the paths.

Say we have this:

```javascript

const myReducer : MyReducer = new MyReducer

const store : Hermes = new Hermes({
  reducers : {
    'my/path' : myReducer
  },
  remote : {
    paths : [
      'my/path'
    ],
    request: (path : string, action : Hermes.Action, state : Object, resolve : Function) => {
      // send some request
      ... // get a payload of data from a remote source

      resolve(payload) // send that data to hermes as part of the action.
    }
  }
})

store.Do(myReducer.MyAction({
  a : 'a',
  b : 'b'
}))

```

And the payload from the request results in:

```javascript

const payload : Object = {
  b : 'otherb',
  c : 'c'
}

```

Your store will look like:

```javascript

const heap : {
  my : {
    path : {
      a : 'a',
      b : 'otherb',
      c : 'c'
    }
  }
}

```

You have two configuration parameters to worry about. 'paths' sets the addresses that requires a remote interaction. it will evaluate based on the path as a prefix, meaning a/b as a remote path, will be
accepted if an action is initialized at path a/b/c. 

You can custom omit paths by returning exactly false in your request function. You will have full access to the original path, action, and the current state. State is important for mutating data on your remote data source, as you will probably need to send it across. 

## Reducers

Rather than being single functions like Redux, these are now class instances that are responsible for:

* Reducing the state based on a given action payload
* Creation of actions
* Creation of events as a result of actions

| Function | Signature | Returns | Description |
| -------- | --------- | ------- | ----------- |
| Reduce   | action : Action, state : Object or Array, payload? : Array or Object | Object or Array | Used to translate previous state into the new state based on Action type |
| Action   | name : string, payload? : Object, context? : Object | Action | This is used internally to create a new action for dispatch to Hermes. |
| Dispatch | eventName : string | void | Used to trigger an event on the system, simply takes the event name |

Creating a Reducer is pretty straight forward:

```javascript

class MyReducer extends Reducer {
  static ACTIONS : Object = { // Setup an index of actions
    CHANGE : 'testreducer.change'
  }
  
  static EVENTS : Object = { // Also an index of events
    CHANGE : 'testreducer.change'
  }

  // Overwrite the Reducer function, which accepts the action, the state and the payload
  Reduce (action : Hermes.Action, state : Object = Object.create(null), payload : Object) {  
    this.Dispatch(TestReducer.EVENTS.CHANGE) // dispatch your event, which will be passed to listening subscribers

    return {...state, ...payload}
  }

  Change (payload : Object) { // Create functions that invoke actions. Actions are created with the reducers base class and must be built this way.
    return this.Action(TestReducer.ACTIONS.CHANGE, payload)
  }
}

```

### Dispatching Events

Unlike Redux, Events and Actions are seperated and you receive Events as a result of an invoked Action. This means you can create as many or as few events as you like within one update.
The resultant state of the reducer will the payload that is given to Subscribed listeners, Hermes handles this for you.

Default Reducers in your tree will dispatch a generic 'change' event

you can reference the default change event like so:

```javascript

store.Subscribe(Reducer.EVENTS.CHANGE, (event : Object) => {
  const {payload, context} = event

  // do something from here.
}, 'my/path')

```

### Reducer Stacking

Because we use paths to delegate Reducers, and paths can cross each other when some are ambiguous, it is entirely possible reducers may overlap. In this event they can stack on your state. Meaning all are applied if many reducers are applicable.

For Example : 

```javascript

const store : Hermes = new Hermes({
  reducers : {
    'test/specific' : new SpecificReducer,
    'test/:general' : new GeneralReducer
  }
})

```
In this case, if specific is specified in an action, both are called, in the order they are originally declared. This may help further in specifically applying behaviours without having to repeat your code.

## Actions

Actions are always created through the reducer they are relevant to, and are created internally by the system, this means all you have to do is call Action and pass though three parameters:

1. The Action Name
2. The Action Payload
3. The Action Context

2 & 3 are not mandatory, payload will effect the state, context indicates to your reducer along what path it has been called.

Signature is:

```javascript

Action (name : string, payload : Object = Object.create(null), context : Object = Object.create(null)) : Hermes.Action

```

## Events

Events are triggered when you call Dispatch inside your reductions. Note you only give the name, and do not pass any data. This is intentional, as what will be returned by hermes once reduction is complete is the resultant state. As you can have multiple reducers on a particular path, it is important that no state data is given to listeners until all changes have been made.

### Init Action

You will probably notice that your reducers may get called with a "__init__" action. This happens when Hermes is unable to determine whether you reducer needs an array or an object as part of it's initial state (sadly using the paths won't cut it, 'test/:path' could denote a dictionary key, or an index on an array). In such an event, as JavaScript is a duck-typed language, and it wouldn't do to have to declare the expected object type, the only thing Hermes can do is test-run your reducer to understand what is expected, in what is returned by default. 

You may want to use this in some way, but otherwise it can be ignored as is meant for internal use.

## Performance

One concern was the use of regex when identifying locations to update data on mass. Running large lists of regex's continually could have a performance impact, and therefore 'reducer caching' has been implemented to ensure that once a path's reducers are known, a record is stored to stop having to re-run them. In this event, first-pass action triggers will invoke a regex test, but after that a dictionary is used to look up the applicable reducers. 

## Further Improvement Notes

Currently, the main concern is the ideas surrounding async server requests injected into state action flow. There may be a requirement to run multiple state updates, one for initial submission, another for successful updating based on network payload, and another for a failure state. It would be entirely possible to update the state based on these network stages, the main question is how best to design the implementation on these further reducer stages.

Possibly namespacing of event / action names. 

Perhaps a backtracking facility, with configuration for how many versions of the state are stored.

