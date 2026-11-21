"use strict";

const RitualQuotes = (() => {
  const library = [
    {
      tags: ["general"],
      text: "有人选午餐时喝水，有人选晚餐前跑步。十二周的记录显示，漏做一次，对习惯的形成影响很小。",
      source: "Lally 等，2010", title: "How are habits formed?",
      url: "https://doi.org/10.1002/ejsp.674"
    },
    {
      tags: ["general"],
      text: "研究者请人每小时记下手上做的事和脑中想的事。手上做着熟悉的动作时，念头更常去了别处。",
      source: "Wood 等，2002", title: "Habits in everyday life",
      url: "https://pubmed.ncbi.nlm.nih.gov/12500811/"
    },
    {
      tags: ["general"],
      text: "一只卡通大象是约好的捐款提醒。前几页出现的都是别种动物时，人们更容易在看见大象时记起约定。",
      source: "Rogers 与 Milkman，2016", title: "Reminders through association",
      url: "https://pubmed.ncbi.nlm.nih.gov/27207873/"
    },
    {
      verse: true, tags: ["general"],
      text: "微雨从东来，好风与之俱。",
      source: "陶渊明《读山海经·其一》", title: "读山海经·其一",
      url: "https://zh.wikisource.org/zh-hans/讀山海經詩#其一"
    },
    {
      verse: true, tags: ["walk", "stretch", "water", "breath"],
      text: "秋山敛馀照，飞鸟逐前侣。",
      source: "王维《木兰柴》", title: "辋川集·木兰柴",
      url: "https://zh.wikisource.org/zh-hans/輞川集_(王維)/木蘭柴"
    },
    {
      tags: ["brush"],
      text: "一组人先用牙线再刷牙，另一组把牙线留到刷完牙。八个月后，后一组用牙线更勤。",
      source: "Judah 等，2013", title: "Forming a flossing habit",
      url: "https://pubmed.ncbi.nlm.nih.gov/22989272/"
    },
    {
      tags: ["walk", "write"],
      text: "给日常物件想些新用途。做这道题时，在跑步机上散步的人比坐着时想出了更多新点子。",
      source: "Oppezzo 与 Schwartz，2014", title: "Give your ideas some legs",
      url: "https://pubmed.ncbi.nlm.nih.gov/24749966/"
    },
    {
      tags: ["read", "write"],
      text: "学生读一段讲血液循环的文字。每读一句就试着讲给自己听的那组，对这段文字理解得更深。",
      source: "Chi 等，1994", title: "Eliciting self-explanations improves understanding",
      url: "https://doi.org/10.1207/s15516709cog1803_3"
    },
    {
      tags: ["read"],
      text: "读完短文，有人重读，有人合上文章回想。一周后，回想过的那组记得更多。",
      source: "Roediger 与 Karpicke，2006", title: "Test-enhanced learning",
      url: "https://pubmed.ncbi.nlm.nih.gov/16507066/"
    },
    {
      tags: ["desk", "write"],
      text: "有件事还没做完，读着别的文章也会想起来。实验里，先定下具体计划的人，读到一半想起它的次数更少。",
      source: "Masicampo 与 Baumeister，2011", title: "Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals",
      url: "https://pubmed.ncbi.nlm.nih.gov/21688924/"
    },
    {
      tags: ["breath"],
      text: "每天五分钟，连续一个月。练习叹息、延长呼气的那组，练完后的心情评分比同样练冥想的那组提高得更多。",
      source: "Balban 等，2023", title: "Brief structured respiration practices enhance mood and reduce physiological arousal",
      url: "https://pubmed.ncbi.nlm.nih.gov/36630953/"
    }
  ];

  function pick(id, mode, day) {
    const pool = library.filter(entry => entry.tags.includes(id) || entry.tags.includes("general"));
    const offset = Array.from(mode + id).reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const dayNumber = Math.floor(Date.parse(day + "T00:00:00Z") / 86400000);
    return pool[((dayNumber + offset) % pool.length + pool.length) % pool.length];
  }

  function show(element, id, mode, day) {
    element.hidden = !id;
    if (!id) return;
    const entry = pick(id, mode, day);
    if (element.dataset.source === entry.url) return;
    element.dataset.source = entry.url;
    const line = document.createElement(entry.verse ? "blockquote" : "p");
    line.textContent = entry.text;
    const link = document.createElement("a");
    link.href = entry.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = entry.source;
    link.title = entry.title;
    link.setAttribute("aria-label", entry.source + " · " + entry.title);
    const credit = document.createElement("cite");
    if (!entry.verse) credit.append("研究摘记 · ");
    credit.append(link);
    element.replaceChildren(line, credit);
  }

  return { show, pick };
})();
