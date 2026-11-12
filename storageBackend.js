(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    ITEMS: "mite_campus_lost_found_items_v1",
    COUNTER: "mite_campus_lost_found_counter_v1",
    INITIALIZED: "mite_campus_lost_found_initialized_v1"
  };

  const VALID_TYPES = ["Lost", "Found"];
  const VALID_STATUSES = ["Active", "Pending Claim", "Resolved"];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emitChange() {
    global.dispatchEvent(new CustomEvent("mite-lf-db-updated"));
  }

  const memoryFallback = {};

  function safeGetItem(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (err) {
      return Object.prototype.hasOwnProperty.call(memoryFallback, key)
        ? memoryFallback[key]
        : null;
    }
  }

  function safeSetItem(key, value) {
    try {
      global.localStorage.setItem(key, value);
      return { ok: true };
    } catch (err) {
      const isQuota =
        err &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22 ||
          err.code === 1014);
      if (isQuota) {
        return {
          ok: false,
          quotaExceeded: true,
          error:
            "Browser LocalStorage 5MB quota reached. Try removing older photos or deleting resolved test records."
        };
      }
      memoryFallback[key] = String(value);
      return { ok: true, usedMemoryFallback: true };
    }
  }

  function parseItemsRaw() {
    try {
      const raw = safeGetItem(STORAGE_KEYS.ITEMS);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      console.error("LocalStorage parse error:", err);
      return null;
    }
  }

  function saveItems(items) {
    const res = safeSetItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    if (!res.ok) {
      return res;
    }
    emitChange();
    return { ok: true };
  }

  function extractNumericSuffix(id) {
    if (typeof id !== "string") return 0;
    const match = id.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function peekNextIDInfo(existingItems) {
    const storedCounter = parseInt(
      safeGetItem(STORAGE_KEYS.COUNTER) || "1000",
      10
    );
    const maxItemNum = existingItems.reduce((max, item) => {
      const num = extractNumericSuffix(item.ID);
      return num > max ? num : max;
    }, 1000);

    const nextNum = Math.max(
      Number.isNaN(storedCounter) ? 1000 : storedCounter,
      maxItemNum
    ) + 1;

    return { nextNum, id: `MITE-LF-${nextNum}` };
  }

  function ensureInitialized() {
    const initialized = safeGetItem(STORAGE_KEYS.INITIALIZED);
    const existing = parseItemsRaw();

    if (!initialized || existing === null) {
      const seed = deepClone((global.MiteSeedData && global.MiteSeedData.SEED_ITEMS) || []);
      safeSetItem(STORAGE_KEYS.ITEMS, JSON.stringify(seed));
      safeSetItem(STORAGE_KEYS.COUNTER, "1003");
      safeSetItem(STORAGE_KEYS.INITIALIZED, "true");
      return seed;
    }
    return existing;
  }

  function getLocalTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validateImageData(value) {
    if (value === undefined || value === null || value === "") {
      return { ok: true, value: "" };
    }
    if (typeof value !== "string") {
      return { ok: false, error: "Uploaded photo format is invalid." };
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, value: "" };
    }
    if (!trimmed.startsWith("data:image/")) {
      return { ok: false, error: "Uploaded photo must be a valid image data URL." };
    }
    if (trimmed.length > 900000) {
      return {
        ok: false,
        error: "Compressed photo is still too large for LocalStorage. Please select a smaller image."
      };
    }
    return { ok: true, value: trimmed };
  }

  const MiteLostFoundAPI = {
    init() {
      const items = ensureInitialized();
      return { ok: true, data: deepClone(items) };
    },

    getItems(filters = {}) {
      const items = ensureInitialized();
      const query = normalizeText(filters.search).toLowerCase();
      const typeFilter = filters.type || "All";
      const categoryFilter = filters.category || "All";
      const statusFilter = filters.status || "All";
      const sortOrder = filters.sort || "newest";

      let result = items.filter((item) => {
        if (typeFilter !== "All" && item.type !== typeFilter) return false;
        if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
        if (statusFilter !== "All" && item.status !== statusFilter) return false;

        if (query) {
          const haystack = [
            item.ID,
            item.itemName,
            item.category,
            item.type,
            item.location,
            item.description,
            item.reporterName,
            item.reporterID,
            item.status,
            item.claimInfo ? item.claimInfo.claimantName : "",
            item.claimInfo ? item.claimInfo.claimantID : ""
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });

      const statusRank = { "Pending Claim": 0, Active: 1, Resolved: 2 };

      result.sort((a, b) => {
        if (sortOrder === "status") {
          const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
          if (rankDiff !== 0) return rankDiff;
        }
        if (sortOrder === "id-asc") {
          return extractNumericSuffix(a.ID) - extractNumericSuffix(b.ID);
        }
        if (sortOrder === "id-desc") {
          return extractNumericSuffix(b.ID) - extractNumericSuffix(a.ID);
        }
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        const dateDiff =
          Number.isNaN(timeA) || Number.isNaN(timeB) ? 0 : timeB - timeA;
        if (sortOrder === "oldest") {
          if (dateDiff !== 0) return -dateDiff;
          return extractNumericSuffix(a.ID) - extractNumericSuffix(b.ID);
        }
        if (dateDiff !== 0) return dateDiff;
        return extractNumericSuffix(b.ID) - extractNumericSuffix(a.ID);
      });

      return { ok: true, data: deepClone(result) };
    },

    getItemById(id) {
      const items = ensureInitialized();
      const targetId = normalizeText(id).toUpperCase();
      const found = items.find((item) => item.ID.toUpperCase() === targetId);
      if (!found) {
        return { ok: false, error: `No item found with ID "${id}".` };
      }
      return { ok: true, data: deepClone(found) };
    },

    createItem(payload) {
      const items = ensureInitialized();

      const type = normalizeText(payload.type);
      const category = normalizeText(payload.category);
      const itemName = normalizeText(payload.itemName);
      const location = normalizeText(payload.location);
      const description = normalizeText(payload.description);
      const reporterName = normalizeText(payload.reporterName);
      const reporterID = normalizeText(payload.reporterID).toUpperCase();
      const date = normalizeText(payload.date) || getLocalTodayISO();

      if (!VALID_TYPES.includes(type)) {
        return { ok: false, error: "Type must be either 'Lost' or 'Found'." };
      }
      if (!category) {
        return { ok: false, error: "Please select a category." };
      }
      if (itemName.length < 2) {
        return { ok: false, error: "Item name must be at least 2 characters." };
      }
      if (!location) {
        return { ok: false, error: "Campus location is required." };
      }
      if (description.length < 8) {
        return { ok: false, error: "Please provide a brief description (at least 8 characters)." };
      }
      if (reporterName.length < 2) {
        return { ok: false, error: "Reporter name is required." };
      }
      if (reporterID.length < 3) {
        return { ok: false, error: "Valid MITE USN / Student ID is required." };
      }

      const imgCheck = validateImageData(payload.imageData);
      if (!imgCheck.ok) {
        return { ok: false, error: imgCheck.error };
      }

      const idInfo = peekNextIDInfo(items);
      const nowIso = new Date().toISOString();

      const newItem = {
        ID: idInfo.id,
        type,
        category,
        itemName,
        location,
        description,
        reporterName,
        reporterID,
        status: "Active",
        date,
        imageData: imgCheck.value,
        claimInfo: null,
        adminNotes: "",
        history: [
          {
            timestamp: nowIso,
            status: "Active",
            actor: `${reporterName} (${reporterID})`,
            note: `${type} item report submitted for ${location}.`
          }
        ]
      };

      const updated = [newItem, ...items];
      const saved = saveItems(updated);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }
      safeSetItem(STORAGE_KEYS.COUNTER, String(idInfo.nextNum));

      return { ok: true, data: deepClone(newItem) };
    },

    submitClaim(id, claimPayload) {
      const items = ensureInitialized();
      const idx = items.findIndex((item) => item.ID === id);
      if (idx === -1) {
        return { ok: false, error: `Item ${id} not found.` };
      }

      const item = items[idx];
      if (item.status === "Resolved") {
        return { ok: false, error: "This item has already been resolved." };
      }
      if (item.status === "Pending Claim") {
        return { ok: false, error: "A claim or handover request is already pending review for this item." };
      }

      const claimantName = normalizeText(claimPayload.claimantName);
      const claimantID = normalizeText(claimPayload.claimantID).toUpperCase();
      const contactInfo = normalizeText(claimPayload.contactInfo);
      const proofNote = normalizeText(claimPayload.proofNote);

      if (claimantName.length < 2) {
        return { ok: false, error: "Your full name is required." };
      }
      if (claimantID.length < 3) {
        return { ok: false, error: "Your MITE USN / Staff ID is required." };
      }
      if (contactInfo.length < 4) {
        return { ok: false, error: "Phone number or MITE email is required." };
      }
      if (proofNote.length < 8) {
        return { ok: false, error: "Please provide verification details or handover info (at least 8 characters)." };
      }

      const nowIso = new Date().toISOString();
      const actionLabel =
        item.type === "Found"
          ? "Ownership claim submitted"
          : "Found report / handover submitted";

      const updatedItem = {
        ...item,
        status: "Pending Claim",
        claimInfo: {
          claimantName,
          claimantID,
          contactInfo,
          proofNote,
          submittedAt: nowIso
        },
        history: [
          ...(item.history || []),
          {
            timestamp: nowIso,
            status: "Pending Claim",
            actor: `${claimantName} (${claimantID})`,
            note: `${actionLabel}: ${proofNote}`
          }
        ]
      };

      const nextItems = [...items];
      nextItems[idx] = updatedItem;
      const saved = saveItems(nextItems);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }

      return { ok: true, data: deepClone(updatedItem) };
    },

    resolveClaim(id, decision, adminNote = "") {
      const items = ensureInitialized();
      const idx = items.findIndex((item) => item.ID === id);
      if (idx === -1) {
        return { ok: false, error: `Item ${id} not found.` };
      }

      const item = items[idx];
      const nowIso = new Date().toISOString();
      const cleanNote = normalizeText(adminNote);

      if (decision === "approve") {
        const updatedItem = {
          ...item,
          status: "Resolved",
          adminNotes: cleanNote || item.adminNotes || "Verified and handed over by Admin.",
          history: [
            ...(item.history || []),
            {
              timestamp: nowIso,
              status: "Resolved",
              actor: "Admin Desk",
              note: cleanNote || "Claim verified and item marked as Resolved."
            }
          ]
        };
        const nextItems = [...items];
        nextItems[idx] = updatedItem;
        const saved = saveItems(nextItems);
        if (!saved.ok) {
          return { ok: false, error: saved.error };
        }
        return { ok: true, data: deepClone(updatedItem) };
      }

      if (decision === "reject") {
        const updatedItem = {
          ...item,
          status: "Active",
          claimInfo: null,
          adminNotes: cleanNote || "Previous claim declined; item reopened for verification.",
          history: [
            ...(item.history || []),
            {
              timestamp: nowIso,
              status: "Active",
              actor: "Admin Desk",
              note: cleanNote || "Claim declined by Admin; status reverted to Active."
            }
          ]
        };
        const nextItems = [...items];
        nextItems[idx] = updatedItem;
        const saved = saveItems(nextItems);
        if (!saved.ok) {
          return { ok: false, error: saved.error };
        }
        return { ok: true, data: deepClone(updatedItem) };
      }

      return { ok: false, error: "Invalid claim decision." };
    },

    updateStatus(id, nextStatus, adminNote = "") {
      if (!VALID_STATUSES.includes(nextStatus)) {
        return { ok: false, error: "Invalid status value." };
      }

      const items = ensureInitialized();
      const idx = items.findIndex((item) => item.ID === id);
      if (idx === -1) {
        return { ok: false, error: `Item ${id} not found.` };
      }

      const item = items[idx];
      const nowIso = new Date().toISOString();
      const cleanNote = normalizeText(adminNote);

      const updatedItem = {
        ...item,
        status: nextStatus,
        claimInfo: nextStatus === "Active" ? null : item.claimInfo,
        adminNotes: cleanNote || item.adminNotes,
        history: [
          ...(item.history || []),
          {
            timestamp: nowIso,
            status: nextStatus,
            actor: "Admin Desk",
            note: cleanNote || `Status updated from ${item.status} to ${nextStatus}.`
          }
        ]
      };

      const nextItems = [...items];
      nextItems[idx] = updatedItem;
      const saved = saveItems(nextItems);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }

      return { ok: true, data: deepClone(updatedItem) };
    },

    updateItem(id, updates) {
      const items = ensureInitialized();
      const idx = items.findIndex((item) => item.ID === id);
      if (idx === -1) {
        return { ok: false, error: `Item ${id} not found.` };
      }

      const item = items[idx];
      const nextStatus = updates.status && VALID_STATUSES.includes(updates.status)
        ? updates.status
        : item.status;
      const nextType = updates.type && VALID_TYPES.includes(updates.type)
        ? updates.type
        : item.type;

      const has = (field) => Object.prototype.hasOwnProperty.call(updates, field);

      const nextCategory = has("category") ? normalizeText(updates.category) : item.category;
      const nextItemName = has("itemName") ? normalizeText(updates.itemName) : item.itemName;
      const nextLocation = has("location") ? normalizeText(updates.location) : item.location;
      const nextDescription = has("description") ? normalizeText(updates.description) : item.description;
      const nextReporterName = has("reporterName") ? normalizeText(updates.reporterName) : item.reporterName;
      const nextReporterID = has("reporterID") ? normalizeText(updates.reporterID).toUpperCase() : item.reporterID;
      const nextDate = has("date") ? (normalizeText(updates.date) || item.date) : item.date;
      const nextAdminNotes = has("adminNotes")
        ? (typeof updates.adminNotes === "string" ? updates.adminNotes.trim() : "")
        : item.adminNotes;

      let nextImageData = item.imageData || "";
      if (has("imageData")) {
        const imgCheck = validateImageData(updates.imageData);
        if (!imgCheck.ok) {
          return { ok: false, error: imgCheck.error };
        }
        nextImageData = imgCheck.value;
      }

      if (!nextCategory) {
        return { ok: false, error: "Category is required." };
      }
      if (nextItemName.length < 2) {
        return { ok: false, error: "Item name must be at least 2 characters." };
      }
      if (!nextLocation) {
        return { ok: false, error: "Campus location is required." };
      }
      if (nextDescription.length < 8) {
        return { ok: false, error: "Description must be at least 8 characters." };
      }
      if (nextReporterName.length < 2) {
        return { ok: false, error: "Reporter name is required." };
      }
      if (nextReporterID.length < 3) {
        return { ok: false, error: "Reporter ID / USN is required." };
      }

      const notesChanged = nextAdminNotes && nextAdminNotes !== (item.adminNotes || "");
      const statusChanged = nextStatus !== item.status;
      const auditNote = notesChanged
        ? `Record updated (${nextStatus}) — Note: ${nextAdminNotes}`
        : statusChanged
          ? `Record updated and status changed from ${item.status} to ${nextStatus}.`
          : `Item details updated by Admin (${nextStatus}).`;

      const updatedItem = {
        ...item,
        type: nextType,
        category: nextCategory,
        itemName: nextItemName,
        location: nextLocation,
        description: nextDescription,
        reporterName: nextReporterName,
        reporterID: nextReporterID,
        date: nextDate,
        imageData: nextImageData,
        status: nextStatus,
        claimInfo: nextStatus === "Active" ? null : item.claimInfo,
        adminNotes: nextAdminNotes,
        history: [
          ...(item.history || []),
          {
            timestamp: new Date().toISOString(),
            status: nextStatus,
            actor: "Admin Desk",
            note: auditNote
          }
        ]
      };

      const nextItems = [...items];
      nextItems[idx] = updatedItem;
      const saved = saveItems(nextItems);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }

      return { ok: true, data: deepClone(updatedItem) };
    },

    deleteItem(id) {
      const items = ensureInitialized();
      const exists = items.some((item) => item.ID === id);
      if (!exists) {
        return { ok: false, error: `Item ${id} not found.` };
      }
      const nextItems = items.filter((item) => item.ID !== id);
      const saved = saveItems(nextItems);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }
      return { ok: true, data: { deletedID: id } };
    },

    getStats() {
      const items = ensureInitialized();
      const total = items.length;
      const lostCount = items.filter((i) => i.type === "Lost").length;
      const foundCount = items.filter((i) => i.type === "Found").length;
      const activeCount = items.filter((i) => i.status === "Active").length;
      const pendingCount = items.filter((i) => i.status === "Pending Claim").length;
      const resolvedCount = items.filter((i) => i.status === "Resolved").length;
      const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

      const categoriesList = (global.MiteSeedData && global.MiteSeedData.CATEGORIES) || [];
      const byCategory = categoriesList
        .map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          return {
            category: cat,
            total: catItems.length,
            lost: catItems.filter((i) => i.type === "Lost").length,
            found: catItems.filter((i) => i.type === "Found").length
          };
        })
        .filter((entry) => entry.total > 0);

      return {
        ok: true,
        data: {
          total,
          lostCount,
          foundCount,
          activeCount,
          pendingCount,
          resolvedCount,
          resolutionRate,
          byCategory
        }
      };
    },

    getAuditLog(limit = 50) {
      const items = ensureInitialized();
      const events = [];

      items.forEach((item) => {
        (item.history || []).forEach((entry, index) => {
          events.push({
            key: `${item.ID}-${index}-${entry.timestamp}`,
            itemID: item.ID,
            itemName: item.itemName,
            type: item.type,
            status: entry.status,
            actor: entry.actor,
            note: entry.note,
            timestamp: entry.timestamp
          });
        });
      });

      events.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        if (Number.isNaN(tA) || Number.isNaN(tB)) return 0;
        return tB - tA;
      });

      return { ok: true, data: deepClone(events.slice(0, limit)) };
    },

    getPotentialMatches(id) {
      const items = ensureInitialized();
      const target = items.find((i) => i.ID === id);
      if (!target) return { ok: true, data: [] };

      const oppositeType = target.type === "Lost" ? "Found" : "Lost";
      const targetTokens = `${target.itemName} ${target.location} ${target.description}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3);

      const matches = items
        .filter((candidate) => {
          if (candidate.ID === target.ID) return false;
          if (candidate.type !== oppositeType) return false;
          if (candidate.status === "Resolved") return false;
          if (candidate.category === target.category) return true;

          const hay = `${candidate.itemName} ${candidate.location} ${candidate.description}`.toLowerCase();
          return targetTokens.some((tok) => hay.includes(tok));
        })
        .slice(0, 3);

      return { ok: true, data: deepClone(matches) };
    },

    resetDemoData() {
      const seed = deepClone((global.MiteSeedData && global.MiteSeedData.SEED_ITEMS) || []);
      safeSetItem(STORAGE_KEYS.ITEMS, JSON.stringify(seed));
      safeSetItem(STORAGE_KEYS.COUNTER, "1003");
      safeSetItem(STORAGE_KEYS.INITIALIZED, "true");
      emitChange();
      return { ok: true, data: seed };
    },

    subscribe(callback) {
      const handleStorage = (e) => {
        if (!e.key || e.key === STORAGE_KEYS.ITEMS) {
          callback();
        }
      };
      const handleLocalUpdate = () => callback();

      global.addEventListener("storage", handleStorage);
      global.addEventListener("mite-lf-db-updated", handleLocalUpdate);

      return () => {
        global.removeEventListener("storage", handleStorage);
        global.removeEventListener("mite-lf-db-updated", handleLocalUpdate);
      };
    }
  };

  global.MiteLostFoundAPI = MiteLostFoundAPI;
})(window);

