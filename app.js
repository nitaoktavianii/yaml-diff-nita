let envA = [], envB = [];
let currentTab = "summary";

// Parse YAML Helm (envVariables) atau OpenShift (env)
function parseYamlEnv(text) {
  try {
    const docs = jsyaml.loadAll(text).filter(Boolean);
    let all = [];

    const pullFrom = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) obj.forEach(pullFrom);
      else {
        if (obj.envVariables && Array.isArray(obj.envVariables)) {
          all = all.concat(obj.envVariables);
        }
        if (obj.env && Array.isArray(obj.env)) {
          all = all.concat(obj.env);
        }
        Object.values(obj).forEach(pullFrom);
      }
    };
    docs.forEach(pullFrom);

    return all.filter(x => x && typeof x === "object" && x.name)
              .map(x => ({ name: String(x.name), value: x.value == null ? "" : String(x.value) }));
  } catch (e) {
    console.error("YAML parse error:", e.message);
    return [];
  }
}

// toMap
function toMap(list) {
  const map = new Map();
  list.forEach(item => map.set(item.name, item.value));
  return map;
}

// diff
function diffEnv(aMap, bMap) {
  const changed = [], addedInB = [], removedFromB = [];

  const allKeys = new Set([...aMap.keys(), ...bMap.keys()]);
  for (const k of allKeys) {
    if (aMap.has(k) && bMap.has(k)) {
      if (aMap.get(k) !== bMap.get(k)) changed.push({ name: k, from: aMap.get(k), to: bMap.get(k) });
    } else if (!aMap.has(k) && bMap.has(k)) {
      addedInB.push({ name: k, value: bMap.get(k) });
    } else if (aMap.has(k) && !bMap.has(k)) {
      removedFromB.push({ name: k, value: aMap.get(k) });
    }
  }
  return { changed, addedInB, removedFromB };
}

// cari duplikat di satu file
function findDuplicates(list) {
  const seen = new Set();
  const dups = [];
  for (const item of list) {
    if (seen.has(item.name)) dups.push(item);
    else seen.add(item.name);
  }
  return dups;
}

// render
function render() {
  const body = document.getElementById("diff-body");
  body.innerHTML = "";

  const { changed, addedInB, removedFromB } = diffEnv(toMap(envA), toMap(envB));
  const dupA = findDuplicates(envA);
  const dupB = findDuplicates(envB);

  document.getElementById("summaryCount").textContent = changed.length + addedInB.length + removedFromB.length + dupA.length + dupB.length;
  document.getElementById("changedCount").textContent = changed.length;
  document.getElementById("addedCount").textContent = addedInB.length;
  document.getElementById("removedCount").textContent = removedFromB.length;
  document.getElementById("dupCount").textContent = dupA.length + dupB.length;

  let rows = [];
  if (currentTab === "summary") {
    rows = [
      ...changed.map(c => `<tr class="changed"><td>${c.name}</td><td>${c.from}</td><td>${c.to}</td></tr>`),
      ...addedInB.map(c => `<tr class="added"><td></td><td></td><td>${c.value}</td></tr>`),
      ...removedFromB.map(c => `<tr class="removed"><td>${c.name}</td><td>${c.value}</td><td></td></tr>`),
      ...dupA.map(c => `<tr class="duplicate"><td>${c.name}</td><td>${c.value}</td><td>Duplicate A</td></tr>`),
      ...dupB.map(c => `<tr class="duplicate"><td>${c.name}</td><td>Duplicate B</td><td>${c.value}</td></tr>`)
    ];
  } else if (currentTab === "changed") {
    rows = changed.map(c => `<tr class="changed"><td>${c.name}</td><td>${c.from}</td><td>${c.to}</td></tr>`);
  } else if (currentTab === "added") {
    rows = addedInB.map(c => `<tr class="added"><td>${c.name}</td><td></td><td>${c.value}</td></tr>`);
  } else if (currentTab === "removed") {
    rows = removedFromB.map(c => `<tr class="removed"><td>${c.name}</td><td>${c.value}</td><td></td></tr>`);
  } else if (currentTab === "duplicates") {
    rows = [
      ...dupA.map(c => `<tr class="duplicate"><td>${c.name}</td><td>${c.value}</td><td>Duplicate A</td></tr>`),
      ...dupB.map(c => `<tr class="duplicate"><td>${c.name}</td><td>Duplicate B</td><td>${c.value}</td></tr>`)
    ];
  }

  body.innerHTML = rows.length ? rows.join("") : `<tr><td colspan="3" class="empty">Belum ada data untuk dibandingkan</td></tr>`;
}

// setup modal
function setupModal(btnId, modalId, applyId, textAId, textBId) {
  const btn = document.getElementById(btnId);
  const modal = document.getElementById(modalId);
  const applyBtn = document.getElementById(applyId);
  const textA = document.getElementById(textAId);
  const textB = document.getElementById(textBId);

  btn.addEventListener("click", () => modal.classList.remove("hidden"));
  modal.querySelector(".cancel").addEventListener("click", () => modal.classList.add("hidden"));

  applyBtn.addEventListener("click", () => {
    envA = parseYamlEnv(textA.value);
    envB = parseYamlEnv(textB.value);
    render();
    modal.classList.add("hidden");
  });
}

setupModal("pastePreProdBtn", "pasteModalPreProd", "applyPreProd", "pastePre", "pasteProd");
setupModal("pasteProdOpBtn", "pasteModalProdOp", "applyProdOp", "pasteProdOpA", "pasteProdOpB");

// reset
document.getElementById("resetBtn").addEventListener("click", () => {
  envA = []; envB = [];
  ["pastePre","pasteProd","pasteProdOpA","pasteProdOpB"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  render();
});

// tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    render();
  });
});

// search
document.getElementById("search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll("#diff-body tr").forEach(row => {
    const name = row.querySelector("td")?.textContent.toLowerCase() || "";
    row.style.display = name.includes(q) ? "" : "none";
  });
});

render();
