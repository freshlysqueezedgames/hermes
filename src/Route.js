import pathToRegexp from 'path-to-regexp'

/**
 * @class Route
 * @description Defines a point of communication across a network, where it should communicate with,
 * and how the request should behave in general.
 */
export default class Route {
  constructor (path : string, props? : Object | boolean) {
    const t : Route = this
    
    if (typeof props !== 'object') {
      props = Object.create(null)
    }

    t.ToPath = pathToRegexp.compile(path)
    t.re = pathToRegexp(path)

    if (props === true) {
      return
    }

    t.query = props.query

    if (props.literalPath) {
      t.literalPath = props.literalPath
    }
  }
}