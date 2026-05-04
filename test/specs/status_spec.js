import { fakeServer } from "nise";
import { Suggestions } from "@/suggestions";

describe("Status features", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const token = "1234";

  beforeEach(function () {
    Suggestions.resetTokens();
    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
      token,
    });
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
    Suggestions.resetTokens();
  });

  it("Should send status request with token", function () {
    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].url).toMatch(/status\/fio/);
    expect(server.requests[0].requestHeaders.Authorization).toEqual(`Token ${token}`);
  });

  it("Should send status request without token", function () {
    server.requests.length = 0;
    instance.setOptions({
      token: null,
    });

    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].url).toMatch(/status\/fio/);
    expect(server.requests[0].requestHeaders.Authorization).toBeUndefined();
  });

  it("Should invoke `onSearchError` callback if status request failed", function () {
    const options = {
      onSearchError: () => {},
      token: "456",
    };
    spyOn(options, "onSearchError");
    instance.setOptions(options);

    server.respond([401, {}, "Not Authorized"]);

    expect(options.onSearchError).toHaveBeenCalled();
  });

  it("Should use url param (if it passed) instead of serviceUrl", function () {
    server.requests.length = 0;
    instance.setOptions({
      token: null,
      url: "http://unchangeable/url",
    });

    expect(server.requests.length).toEqual(1);
    expect(server.requests[0].url).toEqual("http://unchangeable/url");
  });

  describe("Several instances with the same token", function () {
    let input2, instance2;
    beforeEach(function () {
      input2 = document.createElement("input");
      document.body.append(input2);
      instance2 = new Suggestions(input2, {
        serviceUrl,
        type: "NAME",
        token,
      });
    });

    afterEach(function () {
      instance2.dispose();
      input2.remove();
    });

    it("Should use the same authorization query", function () {
      expect(server.requests.length).toEqual(1);
    });

    it("Should make another request for controls of different types", function () {
      instance.setOptions({
        type: "ADDRESS",
        geoLocation: false,
      });

      expect(server.requests.length).toEqual(2);
    });

    it("Should invoke `onSearchError` callback on controls with same type and token", function () {
      const options = {
        onSearchError: () => {},
      };
      spyOn(options, "onSearchError");
      instance2.setOptions(options);

      server.respond([401, {}, "Not Authorized"]);

      expect(options.onSearchError).toHaveBeenCalled();
    });
  });
});
