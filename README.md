# Hermes
## Path Based State Management System

Hermes is an alternative to other flux implementations that uses paths as addresses to locations in state data. It aims to reduce your coding overhead by dynamically creating your state tree from data payloads and path routes, and uses default reducers for Arrays and Objects without you having to explicitly define reducers for every node in the state heap.

It should also be encapsulated enough that using with any DOM Rendering Framework should be intuitive and easy.

It has one dependency : the [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module, which has a handy syntax for writing generalised path syntax, 
you can play around with [testing different paths here](https://forbeslindesay.github.io/express-route-tester/)

Hermes is currently built to handle GraphQL communication, but I will be abstracting this in future work.

** Currently In Development, Not Fully Featured as of Yet **

## Quickstart

If you just want to get into using this straight away...

Create your reducers like so : 

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


## Hermes Class

Hermes acts as your container for a state heap (store), you can have as many or as few as you want, the only caveat is whereever you decide to manage your store should be a wrapper in a way so as to be exposed singularly to the rendering framework heap. You can achieve this as follows, but you may have your own pattern you like to follow:

```javascript

  import Hermes from '@freshlysqueezedgames/hermes'

  let store : Store
  let instance : YourManagementClass

  class YourManagementClass {
    constructor () {
      super(props)

      if (instance) {
        throw new Error('An instance of YourManagementClass already exists, please use YourManagementClass.Instance')
      }

      const t : YourManagementClass = this

      store = new Hermes({
        // [...paths]
        // [...reducers]
      })
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
        c : 'foo'
      }
    }
  }

  const addressToC : string = 'a/b/c' // this path would generate the above

```

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

You invoke an action using the Do method, and must pass it an action that has been created via your reducer:

```javascript

store.Do(myReducer.MyAction({some : data}))

```

Actions are always created via your reducer. See Reducer section

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

const heap : {
  my : {
    path : {}
  }
}

```

The instance of MyReducer will take the action payload, and apply it to the heap, assuming it just applies the payload to the state:

```javascript

const heap : {
  my : {
    path : {
      some : 'data'
    }
  }
}

```

The intention is you will then have a middleware function that hermes accepts for requests, (graphql, REST) and that the resultant payload 
from the request will be combined with any payload you pass in from the client (request payload overwriting client parameters of the same name)

Say we have this:

```javascript

const myReducer : MyReducer = new MyReducer

const store : Hermes = new Hermes({
  paths : {
    'my/path' : true // This path requires a request to the server
  }
  reducers : {
    'my/path' : myReducer
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

NOTE: Some thought will be applied to think about how best to manage request methods, it may be that you want to control how data is applied based on the request that is being 
made. Also, due to the asyncronous nature of these requests, we may need an AsyncReducer class with additional reducer stages for submission (when the request sends) and errors.

## Reducers

Rather than being single functions, these are now class instances that are responsible for:

* Reducing the state based on a given action payload
* Creation of actions
* Creation of events as a result of actions

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