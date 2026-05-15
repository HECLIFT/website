local utils = require("../../utils")

local subs = {
  { key = "Publications",         sub = "Working papers + notes de politique" },
  { key = "Trackers interactifs", sub = "IA + Innovation + Productivité"      },
  { key = "Membres & fellows",    sub = "Direction · Fellows · Conseil"       },
}

return {
  ["kpi-terminal"] = function()
    local kpis = utils.load_data_array("data/kpis.json", "kpis")
    local buf = {}
    for i, k in ipairs(kpis) do
      local s = subs[i] or { key = k.label or "", sub = "" }
      table.insert(buf, table.concat({
        '<div class="t-line">',
          '<div>',
            '<div class="t-key">', utils.esc(s.key), '</div>',
            '<div class="t-sub">', utils.esc(s.sub), '</div>',
          '</div>',
          '<div class="t-val">', tostring(k.num or "—"), '</div>',
        '</div>',
      }))
    end
    return pandoc.RawBlock("html", table.concat(buf, ""))
  end
}
