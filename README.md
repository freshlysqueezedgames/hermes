# Hermes
## Path Based State Management System

Hermes is an alternative to other flux implementations that uses paths as addresses to locations in state data. It aims to reduce your coding overhead by dynamically creating your state tree from data payloads and path routes, and uses default reducers for Arrays and Objects without you having to explicitly define reducers for every node in the state heap.

It should also be encapsulated enough that using with any DOM Rendering Framework should be intuitive and easy.

Hermes is currently built to handle GraphQL communication, but I will be abstracting this in future work.

** Currently In Development, Not Fully Featured as of Yet **

## Hermes

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

  const addressToC : string = 'a/b/c'

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



