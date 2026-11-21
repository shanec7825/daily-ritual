"use strict";

const RitualQuotes = (() => {
  // Source titles identify the work and, where applicable, the chapter or scene.
  // Chinese translations of English passages are prepared for this journal.
  const library = [
    ["苟日新，日日新，又日新。", "《礼记·大学》", "brush desk general"],
    ["如切如磋，如琢如磨。", "《诗经·卫风·淇奥》", "brush write general"],
    ["慎终如始，则无败事。", "《道德经》第六十四章", "brush desk supplement general"],
    ["采菊东篱下，悠然见南山。", "陶渊明《饮酒·其五》", "stretch walk breath"],
    ["行到水穷处，坐看云起时。", "王维《终南别业》", "walk stretch breath"],
    ["千里之行，始于足下。", "《道德经》第六十四章", "walk stretch general"],
    ["问渠那得清如许？为有源头活水来。", "朱熹《观书有感·其一》", "water read"],
    ["上善若水。", "《道德经》第八章", "water supplement"],
    ["知者乐水，仁者乐山。", "《论语·雍也》", "water walk"],
    ["温故而知新，可以为师矣。", "《论语·为政》", "read general"],
    ["纸上得来终觉浅，绝知此事要躬行。", "陆游《冬夜读书示子聿》", "read write general"],
    ["文章本天成，妙手偶得之。", "陆游《文章》", "write"],
    ["山气日夕佳，飞鸟相与还。", "陶渊明《饮酒·其五》", "breath desk"],
    ["致虚极，守静笃。", "《道德经》第十六章", "breath desk"],
    ["草木有本心，何求美人折？", "张九龄《感遇·其一》", "supplement general"],
    ["To see a World in a Grain of Sand", "William Blake · Auguries of Innocence", "read walk general", "在一粒沙里，看见一个世界。"],
    ["Brevity is the soul of wit", "William Shakespeare · Hamlet, II.ii", "write desk", "简洁是才思的灵魂。"],
    ["Ripeness is all.", "William Shakespeare · King Lear, V.ii", "stretch supplement general", "万事自有成熟之时。"],
  ];
  function pick(id, mode, day) {
    const tag = id.startsWith("custom-") ? "general" : id;
    const choices = library.filter(entry => entry[2].split(" ").includes(tag));
    const pool = choices.length ? choices : library.filter(entry => entry[2].includes("general"));
    const offset = Array.from(mode + id).reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return pool[(Math.floor(Date.parse(day + "T00:00:00Z") / 86400000) + offset) % pool.length];
  }
  function show(element, id, mode, day) {
    element.hidden = !id;
    if (!id) return;
    const [original, source, , translation] = pick(id, mode, day);
    if (element.dataset.original === original) return;
    element.dataset.original = original;
    const line = document.createElement("p");
    line.lang = translation ? "en" : "zh-CN";
    line.textContent = original;
    element.replaceChildren(line);
    if (translation) {
      const chinese = document.createElement("p");
      chinese.className = "translation";
      chinese.textContent = translation;
      element.append(chinese);
    }
    const credit = document.createElement("cite");
    credit.textContent = source;
    element.append(credit);
  }
  return { show, pick };
})();
