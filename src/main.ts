import "./poly";
import "./main.css";

import $ from "cash-dom";

import { Suggestions } from "./suggestions";

import { DATA_ATTR_KEY } from "./constants";

$.Suggestions = Suggestions;

$.fn.suggestions = function (options, args) {
  if (arguments.length === 0) {
    return this[0][DATA_ATTR_KEY];
  }

  return this.each(function () {
    const inputElement = $(this);
    let instance = inputElement[0][DATA_ATTR_KEY];

    if (typeof options === "string") {
      if (instance && typeof instance[options] === "function") {
        instance[options](args);
      }
    } else {
      // If instance already exists, destroy it:
      if (instance && instance.dispose) {
        instance.dispose();
      }
      instance = new Suggestions(this, options);
      inputElement[0][DATA_ATTR_KEY] = instance;
    }
  });
};
