/* ============================================================
   JeweloraCraft — Firebase sync layer
   Loaded after data.js. Keeps the existing DB.* API working, but:
   - products & categories are public-read, owner-write (Firestore)
   - orders: customers can only CREATE; only the owner can read them
   - invoices: owner only
   Firebase Auth (email + password) protects the warehouse.
   ============================================================ */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyDcKrK-FOPkxi4nqbBooilpJcBuVLByIuE",
    authDomain: "jeweloracraft-e17cc.firebaseapp.com",
    projectId: "jeweloracraft-e17cc",
    storageBucket: "jeweloracraft-e17cc.firebasestorage.app",
    messagingSenderId: "353317718483",
    appId: "1:353317718483:web:cd669a6c16956be78e8726",
  };

  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK did not load; running in local-only mode.");
    window.JCFB = {
      offline: true,
      addOrder: () => Promise.reject(new Error("Firebase unavailable")),
      onAuth: () => {}, signIn: () => Promise.reject(new Error("Firebase unavailable")),
      signOut: () => Promise.resolve(), resetPassword: () => Promise.reject(new Error("Firebase unavailable")),
      user: () => null,
    };
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const fs = firebase.firestore();
  const auth = typeof firebase.auth === "function" ? firebase.auth() : null;

  const NAMES = ["products", "categories", "orders", "invoices"];
  const cap = n => n[0].toUpperCase() + n.slice(1);
  const remote = { products: {}, categories: {}, orders: {}, invoices: {} };
  const sawEmpty = {};
  const unsubs = {};
  let isOwner = false;
  let currentUser = null;
  const authCbs = [];

  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  const clean = o => JSON.parse(JSON.stringify(o));
  const flagKey = n => "jc_fb_seeded_" + n;

  /* ----- write local changes up to Firestore (owner only) ----- */
  function push(name, list) {
    const col = fs.collection(name);
    const ops = [];
    const seen = {};
    list.forEach((item, i) => {
      if (!item || !item.id) return;
      const data = Object.assign(clean(item), { _i: i });
      seen[item.id] = 1;
      const s = stable(data);
      if (remote[name][item.id] !== s) {
        ops.push(b => b.set(col.doc(String(item.id)), data));
        remote[name][item.id] = s;
      }
    });
    Object.keys(remote[name]).forEach(id => {
      if (!seen[id]) { ops.push(b => b.delete(col.doc(id))); delete remote[name][id]; }
    });
    for (let i = 0; i < ops.length; i += 400) {
      const batch = fs.batch();
      ops.slice(i, i + 400).forEach(op => op(batch));
      batch.commit().catch(err => {
        console.error("Firestore write failed:", err);
        window.dispatchEvent(new CustomEvent("jc-sync-error", { detail: err }));
      });
    }
  }

  /* ----- wrap the DB setters so every save also syncs ----- */
  const origSet = {};
  NAMES.forEach(n => {
    const setter = "set" + cap(n);
    origSet[n] = DB[setter].bind(DB);
    DB[setter] = function (list) {
      origSet[n](list);
      if (isOwner) push(n, list);
    };
  });

  function maybeSeed(name) {
    if (!isOwner || !sawEmpty[name] || localStorage.getItem(flagKey(name))) return;
    const local = DB["get" + cap(name)]();
    if (local.length) push(name, local);
    localStorage.setItem(flagKey(name), "1");
    delete sawEmpty[name];
  }

  /* ----- pull remote changes down into localStorage ----- */
  function listen(name) {
    if (unsubs[name]) return;
    unsubs[name] = fs.collection(name).onSnapshot(snap => {
      if (snap.empty) {
        if (name === "products" || name === "categories") {
          sawEmpty[name] = true; maybeSeed(name); return;       // keep local defaults for visitors
        }
        sawEmpty[name] = true;
        if (isOwner && !localStorage.getItem(flagKey(name))) { maybeSeed(name); return; }
      }
      const items = [];
      remote[name] = {};
      snap.forEach(d => {
        const data = d.data();
        remote[name][d.id] = stable(data);
        items.push(data);
      });
      if (name === "orders") items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      else items.sort((a, b) => (a._i || 0) - (b._i || 0));
      items.forEach(x => delete x._i);
      const local = DB["get" + cap(name)]();
      if (stable(local) === stable(items)) return;
      origSet[name](items);
      window.dispatchEvent(new CustomEvent("db-synced", { detail: { name } }));
    }, err => console.error("Firestore read failed (" + name + "):", err));
  }

  listen("products");
  listen("categories");

  function ownerOn() {
    isOwner = true;
    listen("orders");
    listen("invoices");
    NAMES.forEach(maybeSeed);
  }
  function ownerOff() {
    isOwner = false;
    ["orders", "invoices"].forEach(n => { if (unsubs[n]) { unsubs[n](); delete unsubs[n]; } });
  }

  if (auth) {
    auth.onAuthStateChanged(user => {
      currentUser = user;
      if (user) ownerOn(); else ownerOff();
      authCbs.forEach(cb => cb(user));
    });
  }

  window.JCFB = {
    offline: false,
    /* customers: create an order (rules allow create only) */
    addOrder(order) { return fs.collection("orders").doc(String(order.id)).set(clean(order)); },
    onAuth(cb) { authCbs.push(cb); if (auth && currentUser !== undefined && authReadyOnce) cb(currentUser); },
    signIn(email, pass) { return auth.signInWithEmailAndPassword(email, pass); },
    signOut() { return auth ? auth.signOut() : Promise.resolve(); },
    resetPassword(email) { return auth.sendPasswordResetEmail(email); },
    user() { return currentUser; },
    token() { return currentUser ? currentUser.getIdToken() : Promise.reject(new Error("Not signed in")); },
  };
  let authReadyOnce = false;
  if (auth) auth.onAuthStateChanged(() => { authReadyOnce = true; });
})();
