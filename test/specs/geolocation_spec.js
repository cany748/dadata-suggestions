import { fakeServer } from "nise";
import { Suggestions } from "@/suggestions";

describe("Geolocation", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    Suggestions.resetLocation();
    Suggestions.resetTokens();
    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
    });

    // First request gets service status info
    server.requests.shift().respond(
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        enrich: true,
        name: "address",
        search: true,
        state: "ENABLED",
      }),
    );
    server.queue.shift();
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
    Suggestions.resetTokens();
    Suggestions.resetLocation();
  });

  it("Should send geolocation request if no `geoLocation` option specified", function () {
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].url).toContain("iplocate/address");
  });

  it("Should send geolocation request for party", function () {
    Suggestions.resetLocation();
    server.requests.length = 0;
    server.respond("GET", /status\/party/, [
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        enrich: false,
        name: "party",
        search: true,
        state: "ENABLED",
      }),
    ]);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "PARTY",
    });
    expect(server.requests[1].url).toContain("iplocate/address");
  });

  it("Should send geolocation request for bank", function () {
    Suggestions.resetLocation();
    server.requests.length = 0;
    server.respond("GET", /status\/bank/, [
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        enrich: false,
        name: "bank",
        search: true,
        state: "ENABLED",
      }),
    ]);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "BANK",
    });
    expect(server.requests[1].url).toContain("iplocate/address");
  });

  it("Should send location with request", function () {
    server.respond("GET", /iplocate\/address/, [
      200,
      { "Content-type": "application/json" },
      JSON.stringify({
        location: {
          data: {
            region: "Москва",
            kladr_id: "7700000000000",
          },
          value: "1.2.3.4",
        },
      }),
    ]);

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[1].requestBody).toContain('"locations_boost":[{"kladr_id":"7700000000000"}]');
  });

  it("Should not send geolocation request if `geoLocation` set to false", function () {
    server.requests.length = 0;

    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: false,
    });

    expect(server.requests.length).toEqual(0);
  });

  it("Should not send geolocation request if `geoLocation` set as object", function () {
    server.requests.length = 0;

    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: {
        kladr_id: 83,
      },
    });

    expect(server.requests.length).toEqual(0);
  });

  it("Should send location set by `geoLocation` option as object", function () {
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: {
        kladr_id: "83",
      },
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[1].requestBody).toContain('"locations_boost":[{"kladr_id":"83"}]');
  });

  it("Should send location set by `geoLocation` option as array", function () {
    instance = new Suggestions(input, {
      serviceUrl,
      type: "ADDRESS",
      geoLocation: [{ kladr_id: "77" }, { kladr_id: "50" }],
    });

    input.value = "A";
    instance.onValueChange();

    expect(server.requests[1].requestBody).toContain('"locations_boost":[{"kladr_id":"77"},{"kladr_id":"50"}]');
  });
});
