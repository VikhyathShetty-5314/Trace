(function (global) {
  "use strict";

  const CATEGORIES = [
    "Electronics",
    "ID & Cards",
    "Keys",
    "Bags & Accessories",
    "Books & Stationery",
    "Clothing",
    "Other"
  ];

  const ITEM_TYPES = ["Lost", "Found"];

  const ITEM_STATUSES = ["Active", "Pending Claim", "Resolved"];

  const MITE_LOCATIONS = [
    "Academic Block 1 - CSE Labs",
    "Academic Block 2 - ECE & ISE Wing",
    "Central Library - Reading Hall",
    "MITE Food Court & Canteen",
    "Main Auditorium & Seminar Hall",
    "Placement & Training Cell",
    "Boys Hostel Campus",
    "Girls Hostel Campus",
    "Sports Complex & Ground",
    "College Bus Bay & Parking"
  ];

  const SEED_ITEMS = [
    {
      ID: "MITE-LF-1001",
      type: "Lost",
      category: "Electronics",
      itemName: "iQOO 12 Pro",
      location: "Academic Block 1 - CSE Lab 302",
      description:
        "White Legend Edition iQOO 12 Pro (256GB) in a matte black bumper case. Lock screen has a custom MITE hackathon badge wallpaper.",
      reporterName: "Aarav Shetty",
      reporterID: "4MT23CS014",
      status: "Active",
      date: "2026-11-11",
      claimInfo: null,
      adminNotes: "Reported right after afternoon lab session. Lab assistant notified.",
      history: [
        {
          timestamp: "2026-11-11T10:15:00.000Z",
          status: "Active",
          actor: "Aarav Shetty (4MT23CS014)",
          note: "Lost item report filed for Academic Block 1 - CSE Lab 302."
        }
      ]
    },
    {
      ID: "MITE-LF-1002",
      type: "Found",
      category: "ID & Cards",
      itemName: "MITE Central Library Card",
      location: "Central Library - 2nd Floor Reference Desk",
      description:
        "Laminated MITE Central Library membership card on a navy campus lanyard found near study bay #14. Barcode ends in 8842.",
      reporterName: "Diya Rao",
      reporterID: "4MT24EC042",
      status: "Pending Claim",
      date: "2026-11-11",
      claimInfo: {
        claimantName: "Rohan Kamath",
        claimantID: "4MT23EC067",
        contactInfo: "rohan.4mt23ec067@mite.ac.in",
        proofNote:
          "Barcode ends in 8842 and there is a small green sticker on the back of the card sleeve.",
        submittedAt: "2026-11-12T03:45:00.000Z"
      },
      adminNotes: "Claim awaiting identity verification at the Admin Desk.",
      history: [
        {
          timestamp: "2026-11-11T06:20:00.000Z",
          status: "Active",
          actor: "Diya Rao (4MT24EC042)",
          note: "Found item deposited at Central Library - 2nd Floor Reference Desk."
        },
        {
          timestamp: "2026-11-12T03:45:00.000Z",
          status: "Pending Claim",
          actor: "Rohan Kamath (4MT23EC067)",
          note: "Ownership claim submitted with barcode verification details."
        }
      ]
    },
    {
      ID: "MITE-LF-1003",
      type: "Lost",
      category: "Keys",
      itemName: "Hostel & Two-Wheeler Keys",
      location: "MITE Food Court & Canteen",
      description:
        "Keyring with 3 keys (brass hostel padlock key + Honda Activa key) attached to a dark blue silicone MITE keychain.",
      reporterName: "Karthik Bhat",
      reporterID: "4MT22ME089",
      status: "Active",
      date: "2026-11-12",
      claimInfo: null,
      adminNotes: "Food Court counter staff alerted to hold matching keys.",
      history: [
        {
          timestamp: "2026-11-12T04:10:00.000Z",
          status: "Active",
          actor: "Karthik Bhat (4MT22ME089)",
          note: "Lost item report filed near MITE Food Court & Canteen."
        }
      ]
    }
  ];

  global.MiteSeedData = {
    CATEGORIES,
    ITEM_TYPES,
    ITEM_STATUSES,
    MITE_LOCATIONS,
    SEED_ITEMS
  };
})(window);

