import { fakeServer } from "nise";
import helpers from "../helpers";
import { DEFAULT_OPTIONS, Suggestions } from "@/suggestions";

describe.only("Initialization", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  /**
   * Just a wrapper for a bunch of specs to check that instance is completely initialized
   * Wherever called, runs these specs in current environment
   */
  function checkInitialized() {
    it("Should request service status", function () {
      expect(server.requests.length).toBe(1);
      expect(server.requests[0].url).toContain("/status/fio");
    });

    it("Should create all additional components", function () {
      expect(instance.wrapper).toBeInstanceOf(HTMLElement);
      expect(instance.container).toBeInstanceOf(HTMLElement);
    });
  }

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();
  });

  afterEach(function () {
    server.restore();
  });

  describe("visible element", function () {
    beforeEach(function () {
      input = document.createElement("input");
      document.body.append(input);
      instance = new Suggestions(input, {
        serviceUrl,
        type: "NAME",
      });

      helpers.returnGoodStatus(server);
    });

    afterEach(function () {
      instance.dispose();
      input.remove();
    });

    it("Should initialize suggestions options", function () {
      expect(instance.options.serviceUrl).toEqual(serviceUrl);
    });

    checkInitialized();
  });

  describe("check defaults", function () {
    beforeEach(function () {
      input = document.createElement("input");
      document.body.append(input);
      instance = new Suggestions(input, {
        type: "NAME",
      });

      helpers.returnGoodStatus(server);
    });

    afterEach(function () {
      instance.dispose();
      input.remove();
    });

    it("serviceUrl", function () {
      expect(instance.options.serviceUrl).toEqual(DEFAULT_OPTIONS.serviceUrl);
    });

    checkInitialized();
  });

  describe("check custom options", function () {
    beforeEach(function () {
      input = document.createElement("input");
      document.body.append(input);
      instance = new Suggestions(input, {
        type: "NAME",
        serviceUrl: "http://domain.com",
      });

      helpers.returnGoodStatus(server);
    });

    afterEach(function () {
      instance.dispose();
      input.remove();
    });

    it("serviceUrl", function () {
      expect(instance.options.serviceUrl).toEqual("http://domain.com");
    });

    checkInitialized();
  });
});
