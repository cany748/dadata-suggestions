import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Highlight suggestions", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";

  beforeEach(function () {
    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
      // disable mobile view
      mobileWidth: Number.NaN,
    });
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should highlight search phrase, in the beginning of word", function () {
    input.value = "japa";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Japaneese lives in Japan and love nonjapaneese"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(
      helpers.wrapFormattedValue("<strong>Japa</strong>neese lives in <strong>Japa</strong>n and love nonjapaneese"),
    );
  });

  it("Should highlight search phrase, in the middle of word, if surrounded by delimiters", function () {
    input.value = "japa";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Japaneese and non-japaneese"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(helpers.wrapFormattedValue("<strong>Japa</strong>neese and non-<strong>japa</strong>neese"));
  });

  it("Should highlight search phrase with delimiter in the middle", function () {
    input.value = "санкт-петер";
    instance.onValueChange();

    server.respond(helpers.responseFor(["г Санкт-Петербург"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(helpers.wrapFormattedValue("г <strong>Санкт-Петер</strong>бург"));
  });

  it("Should highlight search phrase with delimiter in the middle, example 2", function () {
    input.value = "на-дон";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Ростовская обл, г Ростов-на-Дону"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain("Ростов-<strong>на-Дон</strong>у");
  });

  it("Should highlight words of search phrase within complex word", function () {
    input.value = "ростов-на дон";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Ростовская обл, г Ростов-на-Дону"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain("<strong>Ростов-на</strong>-<strong>Дон</strong>у");
  });

  it("Should highlight words of search phrase within complex word, example 2", function () {
    instance.setOptions({ type: "PARTY" });
    input.value = "альфа банк";
    instance.onValueChange();

    server.respond(helpers.responseFor(["ОАО АЛЬФА-БАНК"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain("ОАО <strong>АЛЬФА</strong>-<strong>БАНК</strong>");
  });

  it("Should not use object type for highlight if there are matching name", function () {
    instance.setOptions({
      type: "ADDRESS",
    });

    input.value = "Приморский край, Партизанский р-н нико";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Приморский край, Партизанский р-н, поселок Николаевка"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);

    // Слово "р-н" разбивается на два слова "р" и "н", и поскольку "н" находится раньше, чем "нико",
    // оно было бы выбрано для подсветки "Николаевка": <strong>Н</strong>иколаевка
    // Но т.к. "р-н" это наименование типа объекта, оно (и его части) будет подставляться в последнюю очередь.
    // и для подсветки "Николаевка" в итоге будет выбрано более "нико"
    expect(items[0].innerHTML).toContain("<strong>Нико</strong>лаевка");
  });

  it("Should highlight search phrase in quotes", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "фирма";
    instance.onValueChange();

    server.respond(helpers.responseFor(['ООО "Фирма"']));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(helpers.wrapFormattedValue('ООО "<strong>Фирма</strong>"'));
  });

  it("Should highlight names regardless of parts order", function () {
    instance.setOptions({
      params: {
        parts: ["NAME", "PATRONYMIC", "SURNAME"],
      },
    });
    input.value = "Петр Иванович Пе";
    instance.onValueChange();

    server.respond(helpers.responseFor(["Петров Петр Иванович"]));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(
      helpers.wrapFormattedValue("<strong>Петр</strong>ов <strong>Петр</strong> <strong>Иванович</strong>"),
    );
  });

  it("Should highlight address in parties, ignoring address components types", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "КРА";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: 'ООО "Красава"',
          data: {
            address: {
              value: "350056 Россия, Краснодарский край, г Краснодар, п Индустриальный, ул Светлая, д 3",
              data: null,
            },
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");
    const html = items[0].innerHTML;

    expect(items.length).toEqual(1);
    expect(html).toContain("<strong>Кра</strong>снодарский");
    expect(html).toContain("г <strong>Кра</strong>снодар");

    expect(html).toContain("край");
    expect(html).not.toContain("<strong>кра</strong>й");
  });

  it("Should highlight INN in parties (full match)", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "5403233085";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ЗАО Ромашка",
          data: {
            address: {
              value: "Новосибирская",
              data: null,
            },
            inn: "5403233085",
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");
    const html = items[0].innerHTML;
    const pattern = "<strong>54 03 23308 5</strong>".replace(/ /g, '<span class="suggestions-subtext-delimiter"></span>');

    expect(items.length).toEqual(1);
    expect(html).toContain(`<span class="suggestions-subtext suggestions-subtext_inline">${pattern}</span>`);
  });

  it("Should highlight INN in parties (partial match)", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "540323";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ЗАО Ромашка",
          data: {
            address: {
              value: "Новосибирская",
              data: null,
            },
            inn: "5403233085",
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");
    const html = items[0].innerHTML;
    const pattern = "<strong>54 03 23</strong>308 5".replace(/ /g, '<span class="suggestions-subtext-delimiter"></span>');

    expect(items.length).toEqual(1);
    expect(html).toContain(`<span class="suggestions-subtext suggestions-subtext_inline">${pattern}</span>`);
  });

  it("Should escape html entries", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "ЗАО &LT";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ЗАО &LT <b>bold</b>",
          data: {},
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain("<strong>ЗАО</strong> <strong>&amp;LT</strong> &lt;b&gt;bold&lt;/b&gt;");
  });

  it("Should drop the end of text if `maxLength` option specified", function () {
    instance.setOptions({
      type: "PARTY",
      mobileWidth: 20_000,
    });
    instance.isMobile = true;
    input.value = "мфюа калмыц";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value:
            'Филиал КАЛМЫЦКИЙ ФИЛИАЛ АККРЕДИТОВАННОГО ОБРАЗОВАТЕЛЬНОГО ЧАСТНОГО УЧРЕЖДЕНИЯ ВЫСШЕГО ПРОФЕССИОНАЛЬНОГО ОБРАЗОВАНИЯ "МОСКОВСКИЙ ФИНАНСОВО-ЮРИДИЧЕСКИЙ УНИВЕРСИТЕТ МФЮА"',
          data: {},
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toEqual(
      helpers.wrapFormattedValue("Филиал <strong>КАЛМЫЦ</strong>КИЙ ФИЛИАЛ АККРЕДИТОВАННОГО ОБРАЗОВАТ..."),
    );
  });

  it("Should show labels for same-looking suggestions", function () {
    instance.setOptions({
      type: "NAME",
    });

    input.value = "А";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "Антон Николаевич",
          data: {
            name: "Антон",
            surname: null,
            patronymic: "Николаевич",
          },
        },
        {
          value: "Антон Николаевич",
          data: {
            name: "Антон",
            surname: "Николаевич",
            patronymic: null,
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(2);
    expect(items[0].innerHTML).toContain('<span class="suggestions-subtext suggestions-subtext_label">имя, отчество</span>');
    expect(items[1].innerHTML).toContain('<span class="suggestions-subtext suggestions-subtext_label">имя, фамилия</span>');
  });

  it("Should show OGRN instead of INN if match", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "1095403";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ЗАО Ромашка",
          data: {
            address: {
              value: "Новосибирская",
              data: null,
            },
            inn: "5403233085",
            ogrn: "1095403010900",
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain(
      '<span class="suggestions-subtext suggestions-subtext_inline"><strong>1095403</strong>010900</span>',
    );
  });

  it("Should show latin name instead of regular name if match", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "ALFA";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ОАО Альфа-Техника",
          data: {
            inn: "5403233085",
            name: {
              latin: 'JSC "ALFA-TECHNICA"',
            },
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain('JSC "<strong>ALFA</strong>-TECHNICA"');
  });

  it("Should show director's name instead of address if match", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "hf жура";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ООО ХФ Лабс",
          data: {
            inn: "5403233085",
            management: {
              name: "Журавлев Дмитрий Сергеевич",
              post: "Генеральный директор",
            },
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain("</span><strong>Жура</strong>влев Дмитрий Сергеевич</div>");
  });

  it("Should show attribute with status", function () {
    instance.setOptions({
      type: "PARTY",
    });
    input.value = "АМС";
    instance.onValueChange();

    server.respond(
      helpers.responseFor([
        {
          value: "ЗАО АМС",
          data: {
            state: {
              status: "LIQUIDATED",
            },
            type: "LEGAL",
          },
        },
      ]),
    );

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(1);
    expect(items[0].innerHTML).toContain(' data-suggestion-status="LIQUIDATED"');
  });

  it("should show history values", function () {
    instance.setOptions({
      type: "ADDRESS",
    });
    input.value = "казань эсперан";
    instance.onValueChange();

    const suggestions = [
      {
        value: "г Казань, ул Нурсултана Назарбаева",
        unrestricted_value: "респ Татарстан, г Казань, ул Нурсултана Назарбаева",
        data: {
          history_values: ["ул Эсперанто"],
        },
      },
      {
        value: "г Казань, тер ГСК Эсперантовский (Эсперанто)",
        unrestricted_value: "респ Татарстан, г Казань, тер ГСК Эсперантовский (Эсперанто)",
        data: {},
      },
    ];

    server.respond(helpers.responseFor(suggestions));

    const items = instance.container.querySelectorAll(".suggestions-suggestion");

    expect(items.length).toEqual(2);
    expect(items[0].innerHTML).toContain("(бывш. ул <strong>Эсперан</strong>то)");
    expect(items[1].innerHTML).toContain(
      '<span class="suggestions-value"><span class="suggestions-nowrap">г <strong>Казань</strong></span>, <span class="suggestions-nowrap">тер ГСК <strong>Эсперан</strong>товский (<strong>Эсперан</strong>то)</span></span>',
    );
  });
});
