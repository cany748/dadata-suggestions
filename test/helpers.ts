const helpers = {
  isHidden(el: HTMLElement) {
    return el.offsetParent === null;
  },
  keydown(el: HTMLElement, keyCode: number) {
    const event = new KeyboardEvent("keydown", {
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  keyup(el: HTMLElement, keyCode: number) {
    const event = new KeyboardEvent("keyup", {
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  click(el: HTMLElement) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  responseFor(suggestions: any) {
    return [
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        suggestions,
      }),
    ];
  },
  hitEnter(el: HTMLElement) {
    helpers.keydown(el, 13); // code of Enter
  },
  fireBlur(el: HTMLElement) {
    const event = new FocusEvent("blur", {
      bubbles: false,
      cancelable: true,
    });
    el.dispatchEvent(event);
  },
  appendUnrestrictedValue(suggestion: any) {
    return { ...suggestion, unrestricted_value: suggestion.value };
  },
  wrapFormattedValue(value: any, status: any) {
    return `<span class="suggestions-value"${status ? ` data-suggestion-status="${status}"` : ""}>${value}</span>`;
  },
  returnStatus(server: any, status: any) {
    const urlPattern = String.raw`\/status\/(\w)`;

    server.respond("GET", new RegExp(urlPattern), JSON.stringify(status));
  },
  returnGoodStatus(server: any) {
    helpers.returnStatus(server, { search: true, enrich: true });
  },
  returnPoorStatus(server: any) {
    helpers.returnStatus(server, { search: true, enrich: false });
  },
};

export default helpers;
