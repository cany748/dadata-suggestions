import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("After selecting", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
      enrichmentEnabled: false,
    });

    helpers.returnPoorStatus(server);
  });

  afterEach(function () {
    server.restore();
    instance.dispose();
    input.remove();
  });

  it("Should hide dropdown if received suggestions contains only one suggestion equal to current", function () {
    const suggestions = [
      {
        value: "Some value",
        data: null,
      },
    ];

    // show list
    input.value = "S";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    spyOn(instance, "hide");

    // select suggestion from list
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    // list is waiting for being updated
    server.respond(helpers.responseFor(suggestions));

    expect(instance.hide).toHaveBeenCalled();
  });

  it("Should hide dropdown if selected NAME suggestion with all fields filled", function () {
    const suggestions = [
      {
        value: "Surname Name Patronymic",
        data: {
          surname: "Surname",
          name: "Name",
          patronymic: "Patronymic",
          gender: "MALE",
        },
      },
    ];

    input.value = "S";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    spyOn(instance, "getSuggestions");
    spyOn(instance, "hide");

    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    expect(instance.getSuggestions).not.toHaveBeenCalled();
    expect(instance.hide).toHaveBeenCalled();
  });

  it("Should hide dropdown if selected NAME suggestion with name and surname filled for IOF", function () {
    const suggestions = [
      {
        value: "Николай Александрович",
        data: {
          surname: "Александрович",
          name: "Николай",
          patronymic: null,
          gender: "MALE",
        },
      },
    ];

    input.value = "Н";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    spyOn(instance, "getSuggestions");
    spyOn(instance, "hide");

    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    expect(instance.getSuggestions).not.toHaveBeenCalled();
    expect(instance.hide).toHaveBeenCalled();
  });

  it("Should hide dropdown if selected ADDRESS suggestion with `house` field filled", function () {
    const suggestions = [
      {
        value: "Россия, г Москва, ул Арбат, дом 10",
        data: {
          country: "Россия",
          city: "Москва",
          city_type: "г",
          street: "Арбат",
          street_type: "ул",
          house: "10",
          house_type: "дом",
        },
      },
    ];

    instance.setOptions({
      type: "ADDRESS",
      geoLocation: false,
    });
    helpers.returnPoorStatus(server);

    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    spyOn(instance, "getSuggestions");
    spyOn(instance, "hide");

    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    expect(instance.getSuggestions).not.toHaveBeenCalled();
    expect(instance.hide).toHaveBeenCalled();
  });

  it("Should do nothing if select same suggestion twice", function () {
    const suggestion = {
      value: "Some value",
      data: {},
    };
    const options = {
      onSelect: () => {},
    };

    spyOn(options, "onSelect");

    instance.setOptions(options);

    // show list
    input.value = "S";
    instance.onValueChange();
    server.respond(helpers.responseFor([suggestion]));

    instance.setSuggestion(suggestion);

    // select suggestion from list
    instance.selectedIndex = 0;
    helpers.hitEnter(input);

    expect(options.onSelect).not.toHaveBeenCalled();
  });

  it("Should show hint if no suggestions received", function () {
    const suggestions = [];

    instance.setOptions({
      type: "ADDRESS",
      geoLocation: false,
    });
    helpers.returnPoorStatus(server);
    spyOn(instance, "hide");

    input.value = "Р";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));

    const hints = instance.container.querySelectorAll(".suggestions-hint");
    expect(hints.length).toEqual(1);
    expect(instance.hide).not.toHaveBeenCalled();
  });
});
