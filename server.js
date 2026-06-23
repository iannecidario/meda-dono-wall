const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app1MYiXur6iCZkWn";
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || "Donatori";
const AIRTABLE_VIEW = process.env.AIRTABLE_VIEW || "Grid view";
const AIRTABLE_FIELDS = ["NOME", "SOPRANNOME", "CITTA", "CATEGORIA", "FOTO"];

app.use(express.static(__dirname));

app.get("/api/donors", async (_request, response) => {
  if (!process.env.AIRTABLE_TOKEN) {
    response.status(500).json({ error: "AIRTABLE_TOKEN non configurato." });
    return;
  }

  try {
    const records = [];
    let offset = "";

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE
        )}`
      );
      url.searchParams.set("pageSize", "100");
      if (AIRTABLE_VIEW) url.searchParams.set("view", AIRTABLE_VIEW);
      if (offset) url.searchParams.set("offset", offset);
      AIRTABLE_FIELDS.forEach((field) => url.searchParams.append("fields[]", field));

      const airtableResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`
        }
      });
      const page = await airtableResponse.json();

      if (!airtableResponse.ok) {
        response.status(airtableResponse.status).json(page);
        return;
      }

      records.push(...(page.records || []));
      offset = page.offset || "";
    } while (offset);

    response.json(records);
  } catch (error) {
    response.status(500).json({ error: "Errore durante il caricamento dei donatori." });
  }
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`MEdA Donor Wall in ascolto sulla porta ${port}`);
});
