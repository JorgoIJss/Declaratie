import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Send, Trash2, Pencil, History, Settings, Receipt, Upload, Save, Eye, Paperclip } from "lucide-react";

const STORAGE_KEYS = {
  batch: "decl-webapp-current-batch",
  history: "decl-webapp-history",
  settings: "decl-webapp-settings",
};

const defaultSettings = {
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: true,
  smtpUsername: "",
  smtpPassword: "",
  fromEmail: "",
  toEmail: "penningmeester@amervallei.nl",
  fromName: "J. IJsselsteijn",
  iban: "NL37INGB07492765333",
  accountName: "J. IJsselsteijn",
  signatureName: "Jorgo",
  sendIndividuallyByDefault: false,
};

const blankDraft = () => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  supplier: "",
  reason: "",
  hasReceipt: true,
  noReceiptReason: "",
  note: "",
  attachment: null,
  attachmentName: "",
  attachmentType: "",
  createdAt: new Date().toISOString(),
});

function euro(value) {
  const num = Number(String(value).replace(",", ".")) || 0;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(num);
}

function fileSafe(text) {
  return (text || "Declaratie")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "") || "Declaratie";
}

function compactDate(dateValue) {
  return String(dateValue || "").replace(/-/g, "");
}

function detailText(d) {
  const bits = [];
  if (d.note) bits.push(d.note);
  if (!d.hasReceipt && d.noReceiptReason) bits.push(`Geen bon: ${d.noReceiptReason}`);
  return bits.join(" | ");
}

function buildUniqueFileName(declaration, index, submitterName = "Jorgo") {
  const ext = declaration.attachmentName?.split(".").pop() || "jpg";
  const stamp = new Date(declaration.createdAt).toISOString().replace(/[:.]/g, "-");
  return `${compactDate(declaration.date)}_${fileSafe(declaration.supplier)}_${fileSafe(declaration.reason)}_${index}_${stamp}_${fileSafe(submitterName)}.${ext}`;
}

function buildEmailData(batch, settings) {
  if (batch.length === 1) {
    const d = batch[0];
    const subject = `Declaratie BGA - ${compactDate(d.date)}_${fileSafe(d.supplier)}_${fileSafe(d.reason)}`;

    const header = `Nr   Datum       Leverancier        Reden               Bedrag     Bon   Opmerking                 Bestandsnaam`;
    const separator = `------------------------------------------------------------------------------------------------------------------------`;

    const row = `1   ${compactDate(d.date).padEnd(12)}${(d.supplier || "").padEnd(18)}${(d.reason || "").padEnd(18)}${euro(d.amount).padEnd(10)}${(d.hasReceipt ? "Ja" : "Nee").padEnd(5)}${(detailText(d) || "").padEnd(25)}${buildUniqueFileName(d, 1, settings.signatureName)}`;

    const textBody = `Beste penningmeester,


Hierbij dien ik een declaratie in.


${header}
${separator}
${row}



IBAN: ${settings.iban}
Ten name van: ${settings.accountName}



Met vriendelijke groet,
${settings.signatureName}`;

    const htmlBody = `
      <html>
        <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
          <p>Beste penningmeester,</p>
          <p>&nbsp;</p>
          <p>Hierbij dien ik een declaratie in.</p>
          <p>&nbsp;</p>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Nr</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Datum</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Leverancier</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Reden</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bedrag</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bon</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Opmerking</th>
                <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bestandsnaam</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:8px;border:1px solid #d4d4d8;">1</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${compactDate(d.date)}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(d.supplier)}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(d.reason)}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(euro(d.amount))}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${d.hasReceipt ? "Ja" : "Nee"}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(detailText(d))}</td>
                <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(buildUniqueFileName(d, 1, settings.signatureName))}</td>
              </tr>
            </tbody>
          </table>
          <p>&nbsp;</p>
          <p>IBAN: ${escapeHtml(settings.iban)}<br>Ten name van: ${escapeHtml(settings.accountName)}</p>
          <p>&nbsp;</p>
          <p>Met vriendelijke groet,<br>${escapeHtml(settings.signatureName)}</p>
        </body>
      </html>`;

    return {
      subject,
      textBody,
      htmlBody,
      mode: "single",
    };
  }

  const subject = `Declaraties BGA - batch ${new Date().toLocaleString("nl-NL")}`;
  const rows = batch.map((d, idx) => `
    <tr>
      <td style="padding:8px;border:1px solid #d4d4d8;">${idx + 1}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${compactDate(d.date)}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(d.supplier)}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(d.reason)}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(euro(d.amount))}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${d.hasReceipt ? "Ja" : "Nee"}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(detailText(d))}</td>
      <td style="padding:8px;border:1px solid #d4d4d8;">${escapeHtml(buildUniqueFileName(d, idx + 1, settings.signatureName))}</td>
    </tr>`).join("\n\n");

  const total = batch.reduce((sum, d) => sum + (Number(String(d.amount).replace(",", ".")) || 0), 0);
  const htmlBody = `
    <html>
      <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;">
        <p>Beste penningmeester,</p>
        <p>Hierbij dien ik <strong>${batch.length}</strong> declaraties in.</p>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Nr</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Datum</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Leverancier</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Reden</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bedrag</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bon</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Opmerking</th>
              <th style="padding:8px;border:1px solid #d4d4d8;text-align:left;">Bestandsnaam</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p><strong>Totaal: ${euro(total)}</strong></p>
        <p>IBAN: ${escapeHtml(settings.iban)}<br>Ten name van: ${escapeHtml(settings.accountName)}</p>
        <p>Met vriendelijke groet,<br>${escapeHtml(settings.signatureName)}</p>
      </body>
    </html>`;

  const header = `Nr   Datum       Leverancier        Reden               Bedrag     Bon   Opmerking                 Bestandsnaam`;
  const separator = `------------------------------------------------------------------------------------------------------------------------`;
  const textRows = batch
    .map((d, idx) => {
      const nr = String(idx + 1).padEnd(4);
      const datum = compactDate(d.date).padEnd(12);
      const leverancier = (d.supplier || "").substring(0, 18).padEnd(18);
      const reden = (d.reason || "").substring(0, 18).padEnd(18);
      const bedrag = euro(d.amount).padEnd(10);
      const bon = (d.hasReceipt ? "Ja" : "Nee").padEnd(5);
      const opmerking = (detailText(d) || "").substring(0, 25).padEnd(25);
      const bestandsnaam = buildUniqueFileName(d, idx + 1, settings.signatureName);
      return `${nr}${datum}${leverancier}${reden}${bedrag}${bon}${opmerking}${bestandsnaam}`;
    })
    .join("\n\n");

  const textBody = `Beste penningmeester,\n\n\nHierbij dien ik ${batch.length} declaraties in.\n\n\n${header}\n${separator}\n${textRows}\n\n\nTotaal batch: ${euro(total)}\n\n\nIBAN: ${settings.iban}\nTen name van: ${settings.accountName}\n\n\nMet vriendelijke groet,\n${settings.signatureName}`;

  return { subject, textBody, htmlBody, mode: "batch" };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function DeclaratiesWebApp() {
  const [tab, setTab] = useState("declaraties");
  const [batch, setBatch] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draft, setDraft] = useState(blankDraft());
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [previewState, setPreviewState] = useState({ open: false, groups: [], sendIndividually: false });

  useEffect(() => {
    const savedBatch = localStorage.getItem(STORAGE_KEYS.batch);
    const savedHistory = localStorage.getItem(STORAGE_KEYS.history);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    if (savedBatch) setBatch(JSON.parse(savedBatch));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedSettings) setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
  }, []);

  useEffect(() => {
    const persistableBatch = batch.map((item) => ({ ...item, attachment: null }));
    localStorage.setItem(STORAGE_KEYS.batch, JSON.stringify(persistableBatch));
  }, [batch]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const persistable = { ...settings, smtpPassword: settings.smtpPassword };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(persistable));
  }, [settings]);

  const total = useMemo(
    () => batch.reduce((sum, d) => sum + (Number(String(d.amount).replace(",", ".")) || 0), 0),
    [batch]
  );

  function openNewDialog() {
    setEditingId(null);
    setDialogError("");
    setDraft(blankDraft());
    setIsDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingId(item.id);
    setDialogError("");
    setDraft(item);
    setIsDialogOpen(true);
  }

  function saveDraft() {
    setDialogError("");
    if (!draft.date || !draft.amount || !draft.supplier || !draft.reason) {
      setDialogError("Vul datum, bedrag, leverancier en reden in.");
      return;
    }
    const normalizedAmount = Number(String(draft.amount).replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setDialogError("Vul een geldig bedrag in, bijvoorbeeld 12,50.");
      return;
    }
    if (!draft.hasReceipt && !draft.noReceiptReason) {
      setDialogError("Vul een reden in als er geen bon aanwezig is.");
      return;
    }
    const hasExistingAttachment = Boolean(draft.attachment || draft.attachmentName);
    if (!hasExistingAttachment) {
      setDialogError("Voeg een foto of bestand van de bon toe.");
      return;
    }

    const normalized = {
      ...draft,
      submitterName: settings.signatureName || "Jorgo",
      amount: String(draft.amount).replace(",", "."),
      createdAt: draft.createdAt || new Date().toISOString(),
    };

    setBatch((prev) => {
      const next = editingId ? prev.map((x) => (x.id === editingId ? normalized : x)) : [...prev, normalized];
      return next.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    });
    setMessage("Declaratie toegevoegd aan de batch.");
    setDialogError("");
    setIsDialogOpen(false);
    setDraft(blankDraft());
    setEditingId(null);
  }

  function deleteDraft(id) {
    setBatch((prev) => prev.filter((x) => x.id !== id));
  }

  function openPreview(sendIndividually = settings.sendIndividuallyByDefault) {
    if (!batch.length) {
      setMessage("Voeg eerst minimaal één declaratie toe.");
      return;
    }
    const groups = sendIndividually ? batch.map((d) => [d]) : [batch];
    setPreviewState({ open: true, groups, sendIndividually });
    setMessage("");
  }

  async function sendBatch(sendIndividually = settings.sendIndividuallyByDefault) {
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUsername || !settings.smtpPassword || !settings.fromEmail || !settings.toEmail) {
      setTab("settings");
      setMessage("Vul eerst de SMTP-instellingen in op de instellingenpagina.");
      return;
    }
    if (!batch.length) {
      setMessage("Voeg eerst minimaal één declaratie toe.");
      return;
    }

    setIsSending(true);
    setMessage("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const groups = sendIndividually ? batch.map((d) => [d]) : [batch];
      for (const group of groups) {
        const emailData = buildEmailData(group, settings);
        setHistory((prev) => [
          {
            id: crypto.randomUUID(),
            sentAt: new Date().toISOString(),
            mode: emailData.mode,
            subject: emailData.subject,
            declarations: group.map((g) => ({
              id: g.id,
              date: g.date,
              supplier: g.supplier,
              reason: g.reason,
              amount: g.amount,
              hasReceipt: g.hasReceipt,
              noReceiptReason: g.noReceiptReason,
              note: g.note,
              attachmentName: g.attachmentName,
            })),
          },
          ...prev,
        ]);
      }
      setBatch([]);
      setTab("declaraties");
      setMessage("Demo: mail succesvol verwerkt. De batch is geleegd.");
    } catch (err) {
      setMessage(`Verzenden mislukt: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Declaraties webapp</h1>
            <p className="text-sm text-slate-600">Klikbare demo van jouw declaratie-app met lokale opslag en conceptverzending.</p>
          </div>
          <Button onClick={openNewDialog} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Nieuwe declaratie</Button>
        </div>

        {message && (
          <Alert className="rounded-2xl">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl">
            <TabsTrigger value="declaraties"><Receipt className="mr-2 h-4 w-4" />Declaraties</TabsTrigger>
            <TabsTrigger value="historie"><History className="mr-2 h-4 w-4" />Historie</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="declaraties" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle>Huidige batch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {batch.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Nog geen declaraties toegevoegd.</div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nr</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Leverancier</TableHead>
                            <TableHead>Reden</TableHead>
                            <TableHead>Bedrag</TableHead>
                            <TableHead>Bon</TableHead>
                            <TableHead>Acties</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.map((item, idx) => (
                            <TableRow key={item.id}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{compactDate(item.date)}</TableCell>
                              <TableCell>{item.supplier}</TableCell>
                              <TableCell>{item.reason}</TableCell>
                              <TableCell>{euro(item.amount)}</TableCell>
                              <TableCell>
                                <Badge variant={item.hasReceipt ? "default" : "secondary"}>{item.hasReceipt ? "Ja" : "Nee"}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}><Pencil className="h-4 w-4" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => deleteDraft(item.id)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-sm">
                <CardHeader>
                  <CardTitle>Acties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <div className="text-sm text-slate-500">Aantal declaraties</div>
                    <div className="text-2xl font-semibold">{batch.length}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4">
                    <div className="text-sm text-slate-500">Totaalbedrag</div>
                    <div className="text-2xl font-semibold">{euro(total)}</div>
                  </div>
                  <Separator />
                  <Button className="w-full rounded-2xl" onClick={() => openPreview(false)} disabled={isSending || batch.length === 0}><Eye className="mr-2 h-4 w-4" />Bekijk batchmail</Button>
                  <Button className="w-full rounded-2xl" variant="secondary" onClick={() => openPreview(true)} disabled={isSending || batch.length === 0}><Eye className="mr-2 h-4 w-4" />Bekijk losse mails</Button>
                  <Button className="w-full rounded-2xl" variant="outline" onClick={() => setBatch([])} disabled={isSending || batch.length === 0}><Trash2 className="mr-2 h-4 w-4" />Batch leegmaken</Button>
                  <p className="text-xs text-slate-500">In deze demo simuleert ‘Nu echt versturen’ de backend-verwerking. Er wordt geen echte mail verstuurd.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historie">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Historie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Nog geen verzonden batches.</div>
                ) : history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{entry.subject}</div>
                        <div className="text-sm text-slate-500">{new Date(entry.sentAt).toLocaleString("nl-NL")} • {entry.mode}</div>
                      </div>
                      <Badge>{entry.declarations.length} declaratie(s)</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
                  <AlertDescription>
                    Dit is een demo. SMTP-velden blijven bewaard in lokale opslag, maar er wordt geen echte backend aangeroepen.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="SMTP host"><Input value={settings.smtpHost} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} placeholder="smtp.provider.nl" /></Field>
                  <Field label="SMTP poort"><Input value={settings.smtpPort} onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })} placeholder="587" /></Field>
                  <Field label="SMTP gebruikersnaam"><Input value={settings.smtpUsername} onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })} /></Field>
                  <Field label="SMTP wachtwoord"><Input type="password" value={settings.smtpPassword} onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })} /></Field>
                  <Field label="Van e-mailadres"><Input value={settings.fromEmail} onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })} /></Field>
                  <Field label="Van naam"><Input value={settings.fromName} onChange={(e) => setSettings({ ...settings, fromName: e.target.value })} /></Field>
                  <Field label="Naar e-mailadres"><Input value={settings.toEmail} onChange={(e) => setSettings({ ...settings, toEmail: e.target.value })} /></Field>
                  <Field label="IBAN"><Input value={settings.iban} onChange={(e) => setSettings({ ...settings, iban: e.target.value })} /></Field>
                  <Field label="Rekeninghouder"><Input value={settings.accountName} onChange={(e) => setSettings({ ...settings, accountName: e.target.value })} /></Field>
                  <Field label="Naam ondertekening"><Input value={settings.signatureName} onChange={(e) => setSettings({ ...settings, signatureName: e.target.value })} /></Field>
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Gebruik TLS / secure SMTP</div>
                    <div className="text-sm text-slate-500">Meestal aan voor poort 465, vaak uit voor 587 met STARTTLS op de backend.</div>
                  </div>
                  <Switch checked={settings.smtpSecure} onCheckedChange={(checked) => setSettings({ ...settings, smtpSecure: checked })} />
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">Losse mails standaard</div>
                    <div className="text-sm text-slate-500">Als dit aan staat worden declaraties één voor één verwerkt.</div>
                  </div>
                  <Switch checked={settings.sendIndividuallyByDefault} onCheckedChange={(checked) => setSettings({ ...settings, sendIndividuallyByDefault: checked })} />
                </div>

                <Button className="rounded-2xl" onClick={() => setMessage("Instellingen opgeslagen in lokale opslag van de browser.")}><Save className="mr-2 h-4 w-4" />Opslaan</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={previewState.open} onOpenChange={(open) => setPreviewState((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-4xl rounded-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Conceptmail bekijken</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {previewState.groups.map((group, groupIndex) => {
                const emailData = buildEmailData(group, settings);
                const totalAttachments = group.filter((d) => d.attachmentName).length;
                return (
                  <Card key={groupIndex} className="rounded-3xl border shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg">{previewState.sendIndividually ? `Mail ${groupIndex + 1}` : "Batchmail"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">Aan</div>
                          <div className="font-medium">{settings.toEmail || "-"}</div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">Onderwerp</div>
                          <div className="font-medium">{emailData.subject}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-3 text-sm font-medium text-slate-600">Voorbeeld van de mail</div>
                        <div className="rounded-xl border bg-white p-4">
                          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: emailData.htmlBody }} />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-slate-50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700"><Paperclip className="h-4 w-4" />Bijlagen ({totalAttachments})</div>
                        {totalAttachments === 0 ? (
                          <div className="text-sm text-slate-500">Geen bijlagen toegevoegd.</div>
                        ) : (
                          <div className="space-y-2">
                            {group.map((item, idx) => item.attachmentName ? (
                              <div key={item.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                                <span>{buildUniqueFileName(item, idx + 1, settings.signatureName)}</span>
                                <Badge variant="secondary">{item.attachmentType || "bestand"}</Badge>
                              </div>
                            ) : null)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewState((prev) => ({ ...prev, open: false }))}>Sluiten</Button>
              <Button onClick={async () => {
                setPreviewState((prev) => ({ ...prev, open: false }));
                await sendBatch(previewState.sendIndividually);
              }} disabled={isSending}>
                <Send className="mr-2 h-4 w-4" />Nu echt versturen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setDialogError("");
        }}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Declaratie bewerken" : "Nieuwe declaratie"}</DialogTitle>
            </DialogHeader>
            {dialogError && (
              <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-900">
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Datum"><Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
              <Field label="Bedrag (€)"><Input value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="12,50" /></Field>
              <Field label="Leverancier"><Input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} /></Field>
              <Field label="Reden"><Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>
              <div className="md:col-span-2 flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <div className="font-medium">Bon aanwezig</div>
                  <div className="text-sm text-slate-500">Zet uit als er geen bon is.</div>
                </div>
                <Switch checked={draft.hasReceipt} onCheckedChange={(checked) => setDraft({ ...draft, hasReceipt: checked })} />
              </div>
              {!draft.hasReceipt && (
                <div className="md:col-span-2">
                  <Field label="Reden geen bon"><Input value={draft.noReceiptReason} onChange={(e) => setDraft({ ...draft, noReceiptReason: e.target.value })} /></Field>
                </div>
              )}
              <div className="md:col-span-2">
                <Field label="Opmerking"><Textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={3} /></Field>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Foto of bestand van bon</Label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                  key={draft.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setDialogError("");
                    setDraft((prev) => ({
                      ...prev,
                      attachment: file,
                      attachmentName: file.name,
                      attachmentType: file.type,
                    }));
                  }}
                />
                {draft.attachmentName && <div className="text-sm text-slate-500 flex items-center gap-2"><Upload className="h-4 w-4" />{draft.attachmentName}</div>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDialogError("");
                setIsDialogOpen(false);
              }}>Annuleren</Button>
              <Button onClick={saveDraft}>Opslaan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
