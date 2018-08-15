import pathToRegexp from 'path-to-regexp'

/**
 * @class Route
 * @description Defines a point of communication across a network, where it should communicate with,
 * and how the request should behave in general.
 */
export default class Route {
  constructor (path : string) {
    const t : Route = this

    t.originalPath = path
    
    path = `${path}(\/?.*)` // Generalise to always match the beginning, and allow for any number of characters after

    t.ToPath = pathToRegexp.compile(path)
    t.re = pathToRegexp(path)
  }
}