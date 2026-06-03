import { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";

const defaultSettings = {
  columnDefaultsVersion: 2,
  fontFamily: "inter",
  fontSize: 14,
  tableFontSize: 12,
  printFontSize: 12,
  headingWeight: 800,
  density: "compact",
  primaryColor: "151 69% 19%",
  accentColor: "142 68% 29%",
  printTitle: "Incumbency Position",
  printSubtitle: "Punjab Finance Department",
  screenColumns: ["sectionSerial", "name", "designation", "status"],
  printColumns: ["total", "name", "designation", "section"],
};

const columnOptions = [
  { key: "total", label: "Total Sr #" },
  { key: "sectionSerial", label: "Sr.#" },
  { key: "name", label: "Name" },
  { key: "fatherName", label: "Father Name" },
  { key: "designation", label: "Designation" },
  { key: "serviceCadre", label: "Service/Cadre" },
  { key: "section", label: "Section" },
  { key: "personnelNumber", label: "Personnel No." },
  { key: "cnic", label: "CNIC" },
  { key: "mobileNumber", label: "Cell No." },
  { key: "dateOfBirth", label: "DOB" },
  { key: "joining", label: "Joining" },
  { key: "gender", label: "Gender" },
  { key: "status", label: "Status" },
];

const colorPresets = [
  { label: "Punjab Green", value: "151 69% 19%" },
  { label: "Govt Green", value: "142 68% 29%" },
  { label: "Navy", value: "222 70% 20%" },
  { label: "Teal", value: "173 80% 28%" },
  { label: "Charcoal", value: "220 18% 18%" },
  { label: "Emerald", value: "150 70% 26%" },
];

const applySettings = (settings) => {
  localStorage.setItem("hrf_ui_settings", JSON.stringify(settings));
  window.dispatchEvent(new Event("hrf-ui-settings-changed"));
};

const SettingsPage = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("hrf_ui_settings") || "{}");
    const migrated =
      Number(saved.columnDefaultsVersion || 0) < defaultSettings.columnDefaultsVersion
        ? { ...saved, screenColumns: defaultSettings.screenColumns, columnDefaultsVersion: defaultSettings.columnDefaultsVersion }
        : saved;
    if (migrated !== saved) applySettings({ ...defaultSettings, ...migrated, fontFamily: "inter" });
    setSettings({ ...defaultSettings, ...migrated, fontFamily: "inter" });
  }, []);

  const update = (key, value) =>
    setSettings((current) => {
      const next = { ...current, [key]: value };
      applySettings(next);
      return next;
    });

  const toggleColumn = (key, value) =>
    setSettings((current) => {
      const values = current[key] || [];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      const next = { ...current, [key]: nextValues.length ? nextValues : defaultSettings[key] };
      applySettings(next);
      return next;
    });

  const save = () => {
    applySettings(settings);
    toast.success("Display settings saved");
  };

  const reset = () => {
    setSettings(defaultSettings);
    applySettings(defaultSettings);
    toast.success("Display settings reset");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Tune the sheet, print layout, typography, colors, and spacing for daily office use."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <h3 className="text-lg font-bold">Screen Layout</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label-shell">Font Style</span>
              <select className="input-shell" value={settings.fontFamily} onChange={(event) => update("fontFamily", event.target.value)}>
                <option value="inter">Modern Sans (Uniform)</option>
              </select>
            </label>
            <label className="block">
              <span className="label-shell">Density</span>
              <select className="input-shell" value={settings.density} onChange={(event) => update("density", event.target.value)}>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </label>
            <label className="block">
              <span className="label-shell">Base Font Size</span>
              <input className="input-shell" type="number" min="12" max="18" value={settings.fontSize} onChange={(event) => update("fontSize", Number(event.target.value))} />
            </label>
            <label className="block">
              <span className="label-shell">Table Font Size</span>
              <input className="input-shell" type="number" min="10" max="16" value={settings.tableFontSize} onChange={(event) => update("tableFontSize", Number(event.target.value))} />
            </label>
            <label className="block">
              <span className="label-shell">Heading Weight</span>
              <select className="input-shell" value={settings.headingWeight} onChange={(event) => update("headingWeight", Number(event.target.value))}>
                <option value={700}>Bold</option>
                <option value={800}>Extra Bold</option>
                <option value={900}>Black</option>
              </select>
            </label>
            <label className="block">
              <span className="label-shell">Print Font Size</span>
              <input className="input-shell" type="number" min="10" max="16" value={settings.printFontSize} onChange={(event) => update("printFontSize", Number(event.target.value))} />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <h3 className="text-lg font-bold">Brand Colors</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="label-shell">Primary Color</span>
              <select className="input-shell" value={settings.primaryColor} onChange={(event) => update("primaryColor", event.target.value)}>
                {colorPresets.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-shell">Accent Color</span>
              <select className="input-shell" value={settings.accentColor} onChange={(event) => update("accentColor", event.target.value)}>
                {colorPresets.map((color) => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-lg font-bold">Print Header</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-1">
            <span className="label-shell">Print Title</span>
            <input className="input-shell" value={settings.printTitle} onChange={(event) => update("printTitle", event.target.value)} />
          </label>
          <label className="block md:col-span-2">
            <span className="label-shell">Print Subtitle</span>
            <input className="input-shell" value={settings.printSubtitle} onChange={(event) => update("printSubtitle", event.target.value)} />
          </label>
        </div>

        <div
          className="mt-4 rounded-lg border border-border bg-surface-2 p-4"
          style={{
            fontFamily: settings.fontFamily === "serif" ? "Georgia, serif" : settings.fontFamily === "system" ? "Arial, sans-serif" : "Inter, sans-serif",
            fontSize: `${settings.fontSize}px`,
          }}
        >
          <p className="text-center text-lg" style={{ fontWeight: settings.headingWeight }}>{settings.printTitle}</p>
          <p className="mt-1 text-center text-xs text-muted-foreground">{settings.printSubtitle} | Printed date and time appears automatically</p>
          <table className="incumbency-table mt-4 w-full border-collapse bg-white">
            <tbody>
              <tr className="section-row">
                <td colSpan={4}>Budget Section-I</td>
              </tr>
              <tr>
                <td>1</td>
                <td>Sample Name</td>
                <td>Assistant</td>
                <td>Budget Section-I</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Default Columns</h3>
            <p className="mt-1 text-sm text-muted-foreground">Select columns once and save; Incumbency Sheet will open with these screen and print defaults.</p>
          </div>
          <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={save}>
            <Save className="h-4 w-4" />
            Lock Defaults
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            { key: "screenColumns", title: "Screen Columns" },
            { key: "printColumns", title: "Print Columns" },
          ].map((group) => (
            <div key={group.key} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="font-black">{group.title}</h4>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-muted-foreground">
                  {(settings[group.key] || []).length} selected
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {columnOptions.map((column) => (
                  <label key={`${group.key}-${column.key}`} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(settings[group.key] || []).includes(column.key)}
                      onChange={() => toggleColumn(group.key, column.key)}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
