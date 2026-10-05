import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Adding space on selecting", function () {
  const serviceUrl = "/some/url";

  describe("For NAME controls", function () {
    let input, instance, server;
    beforeEach(function () {
      Suggestions.resetTokens();

      server = fakeServer.create();

      input = document.createElement("input");
      document.body.append(input);
      instance = new Suggestions(input, {
        serviceUrl,
        type: "NAME",
      });

      helpers.returnPoorStatus(server);
    });

    afterEach(function () {
      server.restore();
      instance.dispose();
      input.remove();
    });

    it("Should add SPACE at the end if only NAME specified", async () => {
      input.value = "N";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Name",
            data: {
              surname: null,
              name: "Name",
              patronymic: null,
              gender: "MALE",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Name ");
    });

    it("Should add SPACE at the end if only SURNAME specified", async () => {
      input.value = "S";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Surname",
            data: {
              surname: "Surname",
              name: null,
              patronymic: null,
              gender: "MALE",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Surname ");
    });

    it("Should add SPACE at the end if only NAME and PATRONYMIC specified", async () => {
      input.value = "N";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Name Patronymic",
            data: {
              surname: null,
              name: "Name",
              patronymic: "Patronymic",
              gender: "MALE",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Name Patronymic ");
    });

    it("Should not add SPACE at the end if full name specified", async () => {
      input.value = "S";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Surname Name Patronymic",
            data: {
              surname: "Surname",
              name: "Name",
              patronymic: "Patronymic",
              gender: "MALE",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Surname Name Patronymic");
    });

    it("Should not add SPACE if only part expected", async () => {
      instance.setOptions({
        params: {
          parts: ["SURNAME"],
        },
      });
      input.value = "S";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Surname",
            data: {
              surname: "Surname",
              name: null,
              patronymic: null,
              gender: "UNKNOWN",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Surname");
    });

    it("Should not add SPACE if only part expected (params set as function)", async () => {
      instance.setOptions({
        params() {
          return {
            parts: ["SURNAME"],
          };
        },
      });
      input.value = "S";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Surname",
            data: {
              surname: "Surname",
              name: null,
              patronymic: null,
              gender: "UNKNOWN",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Surname");
    });
  });

  describe("For ADDRESS controls", function () {
    let input, instance, server;
    beforeEach(function () {
      Suggestions.resetTokens();

      server = fakeServer.create();

      input = document.createElement("input");
      document.body.append(input);
      instance = new Suggestions(input, {
        serviceUrl,
        type: "ADDRESS",
        geoLocation: false,
        enrichmentEnabled: false,
      });

      helpers.returnPoorStatus(server);
    });

    afterEach(function () {
      instance.dispose();
      server.restore();
      input.remove();
    });

    it("Should add SPACE at the end if only COUNTRY specified", async () => {
      input.value = "Р";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Россия",
            data: {
              country: "Россия",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.keydown(input, 13);

      await expect.poll(() => input.value).toEqual("Россия ");
    });

    it("Should add SPACE at the end if COUNTRY..HOUSE specified", async () => {
      input.value = "Р";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Россия, г Москва, ул Арбат, д 1",
            data: {
              country: "Россия",
              city: "Москва",
              city_type: "г",
              street: "Арбат",
              street_type: "ул",
              house_type: "д",
              house: "1",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.hitEnter(input);

      await expect.poll(() => input.value).toEqual("Россия, г Москва, ул Арбат, д 1 ");
    });

    it("Should not add SPACE at the end if FLAT specified", async () => {
      input.value = "Р";
      instance.onValueChange();
      server.respond(
        helpers.responseFor([
          {
            value: "Россия, г Москва, ул Арбат, д 1, кв 22",
            data: {
              country: "Россия",
              city: "Москва",
              city_type: "г",
              street: "Арбат",
              street_type: "ул",
              house: "1",
              house_type: "д",
              flat: "22",
              flat_type: "кв",
            },
          },
        ]),
      );
      await expect.poll(() => instance.visible).toBe(true);

      instance.selectedIndex = 0;
      helpers.hitEnter(input);

      await expect.poll(() => input.value).toEqual("Россия, г Москва, ул Арбат, д 1, кв 22");
    });
  });
});
