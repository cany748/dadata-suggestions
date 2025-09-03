/* eslint-disable */
import $ from "cash-dom";

// Deferred definition
const Deferred = function () {
  // Private members - Starts
  const options = arguments[0] || {};
  let stateString = "pending";

  let successCallBacks = [];
  let failureCallBacks = [];
  let progressCallBacks = [];
  let resolveArguments = [];
  let rejectArguments = [];
  let progressArguments = [];
  let isProgressNotified = false;

  const resolve = function () {
    const self = this;
    if (stateString == "pending") {
      resolveArguments = arguments;
      callFunction.call(self, successCallBacks, resolveArguments, { sameArgument: true });
      stateString = "resolved";
    }
    return self;
  };

  const reject = function () {
    const self = this;
    if (stateString == "pending") {
      rejectArguments = arguments;
      callFunction.call(self, failureCallBacks, rejectArguments, { sameArgument: true });
      stateString = "rejected";
    }
    return self;
  };

  const notify = function () {
    const self = this;
    if (stateString == "pending") {
      progressArguments = arguments;
      callFunction.call(self, progressCallBacks, progressArguments, { sameArgument: true });
      isProgressNotified = true;
    }
    return self;
  };

  const done = function () {
    const self = this;
    const argumentsArray = Array.prototype.slice.call(arguments);
    successCallBacks = successCallBacks.concat(argumentsArray);
    if (stateString == "resolved") {
      callFunction.call(self, argumentsArray, resolveArguments, { sameArgument: true });
    }
    return self;
  };

  const fail = function () {
    const self = this;
    const argumentsArray = Array.prototype.slice.call(arguments);
    failureCallBacks = failureCallBacks.concat(argumentsArray);
    if (stateString == "rejected") {
      callFunction.call(self, argumentsArray, rejectArguments, { sameArgument: true });
    }
    return self;
  };

  const progress = function () {
    const self = this;
    const argumentsArray = Array.prototype.slice.call(arguments);
    progressCallBacks = progressCallBacks.concat(argumentsArray);
    if (stateString == "pending" && isProgressNotified) {
      callFunction.call(self, argumentsArray, progressArguments, { sameArgument: true });
    }
    return self;
  };

  const always = function () {
    const self = this;
    const argumentsArray = Array.prototype.slice.call(arguments);
    successCallBacks = successCallBacks.concat(argumentsArray);
    failureCallBacks = failureCallBacks.concat(argumentsArray);
    if (stateString != "pending") {
      callFunction.call(self, argumentsArray, resolveArguments || rejectArguments, { sameArgument: true });
    }
    return self;
  };

  const then = function () {
    const self = this;
    const argumentsTemp = [];
    for (const index in arguments) {
      let itemToPush;
      itemToPush = Array.isArray(arguments[index]) ? arguments[index] : [arguments[index]];
      argumentsTemp.push(itemToPush);
    }
    done.apply(self, argumentsTemp[0]);
    fail.apply(self, argumentsTemp[1]);
    progress.apply(self, argumentsTemp[2]);
    return self;
  };

  const promise = function () {
    const self = this;
    const methodsToRemove = new Set(["resolve", "reject", "promise", "notify"]);
    const promiseObject = {};
    for (const key in self) {
      if (!methodsToRemove.has(key)) {
        promiseObject[key] = self[key];
      }
    }
    return promiseObject;
  };

  const state = function () {
    const self = this;
    if (arguments.length > 0) stateString = arguments[0];
    return stateString;
  };

  var callFunction = function (functionDefinitionArray, functionArgumentArray, options) {
    const self = this;
    options = options || {};
    const scope = options.scope || self;
    let forEachDefinition;
    forEachDefinition = options.sameArgument
      ? function (item, index) {
          if (typeof item == "function") item.apply(scope, functionArgumentArray);
        }
      : function (item, index) {
          if (typeof item == "function") item.apply(scope, functionDefinitionArray[index]);
        };
    for (const index in functionDefinitionArray) {
      forEachDefinition(functionDefinitionArray[index], index);
    }
  };
  // Private members - Ends

  // Public members - Starts
  this.resolve = function () {
    return Reflect.apply(resolve, this, arguments);
  };

  this.reject = function () {
    return Reflect.apply(reject, this, arguments);
  };

  this.notify = function () {
    return Reflect.apply(notify, this, arguments);
  };

  this.done = function () {
    return Reflect.apply(done, this, arguments);
  };

  this.fail = function () {
    return Reflect.apply(fail, this, arguments);
  };

  this.progress = function () {
    return Reflect.apply(progress, this, arguments);
  };

  this.always = function () {
    return Reflect.apply(always, this, arguments);
  };

  this.then = function () {
    return Reflect.apply(then, this, arguments);
  };

  this.promise = function () {
    return Reflect.apply(promise, this, arguments);
  };

  this.state = function () {
    return state.apply(this);
  };
  // Public members - Ends
};

$.Deferred = Deferred;
