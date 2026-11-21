"use strict";

const Ritual = (() => {
  const newDayHour = 4;
  const routines = {
    morning: [
      { id: "brush", title: "刷牙", label: "刷牙", core: true },
      { id: "stretch", title: "伸展一下", label: "伸展一下", prompt: "选一个舒服的动作。" },
      { id: "read", title: "阅读", label: "阅读", prompt: "读一页就好。" },
      { id: "write", title: "写作表达", label: "写作表达", prompt: "说或写下一个想法。" },
      { id: "water", title: "喝水", label: "喝水" },
      { id: "walk", title: "闲走", label: "闲走", prompt: "离开屏幕走一会儿。" },
      { id: "supplement", title: "补品", label: "补品", prompt: "按自己原有的安排记录。" }
    ],
    evening: [
      { id: "desk", title: "整理桌面", label: "整理桌面", prompt: "收走一样也算。", done: "给明早腾出了一块地方。", core: true },
      { id: "brush", title: "睡前刷牙", label: "睡前刷牙", core: true },
      { id: "breath", title: "呼吸或冥想", label: "呼吸或冥想" },
      { id: "read", title: "阅读", label: "阅读", prompt: "读一页就好。" },
      { id: "write", title: "写作表达", label: "写作表达", prompt: "说或写下一个想法。" },
      { id: "water", title: "喝水", label: "喝水" },
      { id: "walk", title: "闲走", label: "闲走" },
      { id: "supplement", title: "补品", label: "补品", prompt: "按自己原有的安排记录。" }
    ]
  };

  function dateKey(date) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
      .join("-");
  }

  function offsetDay(key, offset) {
    const [year, month, day] = key.split("-").map(Number);
    return dateKey(new Date(year, month - 1, day + offset, 12));
  }

  function activeDay(mode, now) {
    const today = dateKey(now);
    return mode === "evening" && now.getHours() < newDayHour ? offsetDay(today, -1) : today;
  }

  function defaultMode(now) {
    const hour = now.getHours();
    return hour >= 18 || hour < newDayHour ? "evening" : "morning";
  }

  function getActions(store, day, mode) {
    return store.days[day]?.[mode] ?? {};
  }

  function getSteps(store, mode, includePaused = false) {
    const steps = store.habits?.[mode] ?? routines[mode].filter(step => step.id !== "supplement");
    return steps.filter(step => includePaused || !step.paused);
  }

  function currentAction(mode, actions, selected, store = {}) {
    const steps = getSteps(store, mode);
    const current = steps.find(step => step.id === selected) ?? steps.find(step => !actions[step.id]);
    if (current) return current;
    if (!steps.length) return { id: "finished", title: "添加一个小习惯", label: "空列表", prompt: "从下方「管理」安排这个时段的习惯。" };
    const { done, skipped } = roundProgress(steps, actions);
    const period = mode === "morning" ? "今晨" : "今晚";
    return {
      id: "finished", label: "本轮结束",
      title: skipped ? `${period}完成 ${done} 项` : `${period} ${done} 项，全部完成`,
      prompt: skipped ? `还有 ${skipped} 项已跳过，点选习惯即可补做。` : "可以休息一下了。"
    };
  }

  function roundProgress(steps, actions) {
    let done = 0;
    let skipped = 0;
    let latest;
    for (const step of steps) {
      const entry = actions[step.id];
      if (entry?.status === "done") {
        done++;
        if (!latest || entry.at > actions[latest.id].at) latest = step;
      } else if (entry?.status === "skipped") skipped++;
    }
    return { done, skipped, latest };
  }

  function nextAction(store, mode, actions, id) {
    const steps = getSteps(store, mode);
    const index = steps.findIndex(step => step.id === id);
    return [...steps.slice(index + 1), ...steps.slice(0, index + 1)].find(step => !actions[step.id])?.id;
  }

  function companionGrowth(store, throughDay) {
    let days = 0;
    for (const [day, record] of Object.entries(store.days)) {
      if (day > throughDay) continue;
      const practiced = ["morning", "evening"].some(period =>
        Object.entries(record[period] ?? {}).some(([id, entry]) => id !== "supplement" && entry.status === "done")
      );
      if (practiced) days++;
    }
    if (days >= 30) return { days, stage: "adult", label: "成鸟" };
    if (days >= 7) return { days, stage: "juvenile", label: "幼鸟" };
    return { days, stage: "chick", label: "雏鸟" };
  }

  function habitDoneOn(store, mode, id, day) {
    if (id.startsWith("supplement-")) return supplementChecks(store, day)[id.slice(11)] === mode;
    return getActions(store, day, mode)[id]?.status === "done";
  }

  function recentHabitDays(store, mode, id, throughDay) {
    let days = 0;
    for (let offset = 0; offset < 28; offset++) {
      if (habitDoneOn(store, mode, id, offsetDay(throughDay, -offset))) days++;
    }
    return days;
  }

  function heatmap(store, mode, id, end, period) {
    const [year, month] = end.split("-").map(Number);
    const start = period === "year" ? `${year}-01-01` : period === "month" ? `${year}-${String(month).padStart(2, "0")}-01` : offsetDay(end, -6);
    const last = period === "year" ? `${year}-12-31` : period === "month" ? offsetDay(dateKey(new Date(year, month, 1, 12)), -1) : end;
    const cells = [];
    for (let key = start; key <= last; key = offsetDay(key, 1)) {
      const recorded = habitDoneOn(store, mode, id, key);
      cells.push({ day: key, future: key > end, done: key <= end && recorded });
    }
    return cells;
  }

  function saveAction(store, day, mode, id, status) {
    const record = store.days[day] ??= {};
    const actions = record[mode] ??= {};
    const existing = actions[id];
    if (existing?.status === status) return;
    if (status) {
      actions[id] = { status, at: Date.now() };
      if (existing?.status === "skipped" && status === "done") actions[id].wasSkipped = true;
    } else if (existing?.wasSkipped) {
      actions[id] = { status: "skipped", at: Date.now() };
    } else {
      delete actions[id];
    }
  }

  function saveNote(store, day, field, value) {
    const record = store.days[day] ??= {};
    const note = record.note ??= {};
    if (value) note[field] = value;
    else delete note[field];
    if (!note.lightsOut && !note.snack) delete record.note;
  }

  function supplementChecks(store, day) {
    return store.days[day]?.supplementChecks ?? {};
  }

  function setSupplementCheck(store, day, id, mode) {
    const record = store.days[day] ??= {};
    const checks = record.supplementChecks ??= {};
    if (mode) checks[id] = mode;
    else delete checks[id];
  }

  function weekEnding(store, lastDay) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = offsetDay(lastDay, index - 6);
      const checkedSlots = Object.values(supplementChecks(store, day));
      const done = mode => {
        const actions = getActions(store, day, mode);
        const count = Object.values(actions).filter(entry => entry.status === "done").length;
        return count + Number(actions.supplement?.status !== "done" && checkedSlots.includes(mode));
      };
      return { day, morning: done("morning"), evening: done("evening"), desk: getActions(store, day, "evening").desk?.status === "done", note: store.days[day]?.note };
    });
  }

  function readEntry(store, path, value) {
    const [day, mode, field] = path.split("/");
    if (value === null) return;
    if (day === "habit-settings" && Object.hasOwn(routines, mode) && field === undefined) {
      let items;
      try { items = JSON.parse(value); } catch { return; }
      if (!Array.isArray(items) || items.length > 100) return;
      const seen = new Set();
      const valid = items.every(item => item && typeof item.id === "string" &&
        (routines[mode].some(step => step.id === item.id && item.id !== "supplement") || /^custom-[a-f0-9]{24}$/.test(item.id)) &&
        !seen.has(item.id) && seen.add(item.id) && typeof item.title === "string" && item.title.trim() && item.title.length <= 40);
      if (valid) {
        store.habits ??= {};
        store.habits[mode] = items.map(item => ({ id: item.id, title: item.title, label: item.title, paused: item.paused === true,
          prompt: routines[mode].find(step => step.id === item.id)?.prompt }));
      }
      return;
    }
    if (day === "supplement-settings" && /^[a-f0-9]{24}$/.test(mode) && field === undefined) {
      let item;
      try { item = JSON.parse(value); } catch { return; }
      if (typeof item?.name === "string" && item.name.trim() && item.name.length <= 40 && Object.hasOwn(routines, item.mode)) {
        store.supplements[mode] = { name: item.name, mode: item.mode, paused: item.paused === true };
      }
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    if (mode === "supplement-check" && /^[a-f0-9]{24}$/.test(field) && Object.hasOwn(routines, value)) {
      setSupplementCheck(store, day, field, value);
      return;
    }
    if (mode === "note") {
      if ((field === "lightsOut" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) ||
        (field === "snack" && ["yes", "no"].includes(value))) saveNote(store, day, field, value);
      return;
    }
    if (!Object.hasOwn(routines, mode) || !(routines[mode].some(step => step.id === field) || /^custom-[a-f0-9]{24}$/.test(field))) return;
    let entry;
    try { entry = JSON.parse(value); } catch { return; }
    if (!["done", "skipped"].includes(entry?.status) || !Number.isFinite(entry.at)) return;
    const record = store.days[day] ??= {};
    const actions = record[mode] ??= {};
    actions[field] = entry;
  }

  return { routines, getSteps, roundProgress, nextAction, heatmap, recentHabitDays, companionGrowth, offsetDay, activeDay, defaultMode, getActions, currentAction, saveAction, saveNote, supplementChecks, setSupplementCheck, weekEnding, readEntry };
})();
