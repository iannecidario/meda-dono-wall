# ALBO DEI DONATORI - Museo MEdA di Aquilonia

Web app responsive per consultare pubblicamente i donatori del Museo MEdA.

## Collegamento ad Airtable

Apri `config.js` e imposta:

- `enabled: true`
- `tableNameOrId`: nome o ID della tabella Airtable
- `viewNameOrId`: nome o ID vista, se vuoi limitare i record a una vista
- `token`: token Airtable con permesso di lettura

Il `baseId` è già impostato sul database indicato:

```js
baseId: "app1MYiXur6iCZkWn"
```

Nota: un token inserito in una pagina statica è visibile a chi apre il sito. Per un kiosk pubblico è preferibile usare `proxyUrl`, cioè un piccolo servizio server che interroga Airtable senza esporre il token.

## Campi attesi

- `NOME`
- `SOPRANNOME`
- `CITTA`
- `CATEGORIA`
- `FOTO`

Il filtro alfabetico usa la prima parola di `NOME` come cognome.

## Avvio locale

La web app è statica. Può essere aperta direttamente da `index.html` oppure pubblicata su un normale hosting statico.
