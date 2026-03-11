import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
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

const SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";
const RECEIPTS_BUCKET = "declaratie-bonnen";

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
  attachmentPath: "",
  attachmentPublicUrl: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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
  const stamp = new Date(declaration.createdAt || new Date().toISOString()).toISOString().replace(/[:.]/g, "-");
  return `${compactDate(declaration.date)}_${fileSafe(declaration.supplier)}_${fileSafe(declaration.reason)}_${index}_${stamp}_${fileSafe(submitterName)}.${ext}`;
}

function buildEmailData(batch, settings) {
  if (batch.length === 1) {
    const d = batch[0];
    const subject = `Declaratie BGA - ${compactDate(d.date)}_${fileSafe(d.supplier)}_${fileSafe(d.reason)}`;

    const header = `Nr   Datum       Leverancier        Reden               Bedrag     Bon   Opmerking                 Bestandsnaam`;
    const separator = `------------------------------------------------------------------------------------------------------------------------`;

    const row = `1   ${compactDate(d.date).padEnd(12)}${(d.supplier || "").padEnd(18)}${(d.reason || "").padEnd(18)}${euro(d.amount).padEnd(10)}${(d.hasReceipt ? "Ja" : "Nee").padEnd(5)}${(detailText(d) || "").padEnd(25)}${buildUniqueFileName(d, 1, settings.signatureName)}`;

    const textBody = `Beste penningmeester,\n\n\nHierbij dien ik een declaratie in.\n\n\n${header}\n${separator}\n${row}\n\n\n\nIBAN: ${settings.iban}\nTen name van: ${settings.accountName}\n\n\n\nMet vriendelijke groet,\n${settings.signatureName}`;

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

function mapSettingsFromDb(row) {
  if (!row) return { ...defaultSettings };
  return {
    ...defaultSettings,
    smtpHost: row.smtp_host ?? defaultSettings.smtpHost,
    smtpPort: row.smtp_port ?? defaultSettings.smtpPort,
    smtpSecure: row.smtp_secure ?? defaultSettings.smtpSecure,
    smtpUsername: row.smtp_username ?? defaultSettings.smtpUsername,
    smtpPassword: row.smtp_password ?? defaultSettings.smtpPassword,
    fromEmail: row.from_email ?? defaultSettings.fromEmail,
    toEmail: row.to_email ?? defaultSettings.toEmail,
    fromName: row.from_name ?? defaultSettings.fromName,
    iban: row.iban ?? defaultSettings.iban,
    accountName: row.account_name ?? defaultSettings.accountName,
    signatureName: row.signature_name ?? defaultSettings.signatureName,
    sendIndividuallyByDefault: row.send_individually_by_default ?? defaultSettings.sendIndividuallyByDefault,
  };
}

function mapSettingsToDb(settings) {
  return {
    id: SETTINGS_ROW_ID,
    smtp_host: settings.smtpHost,
    smtp_port: settings.smtpPort,
    smtp_secure: settings.smtpSecure,
    smtp_username: settings.smtpUsername,
    smtp_password: settings.smtpPassword,
    from_email: settings.fromEmail,
    to_email: settings.toEmail,
    from_name: settings.fromName,
    iban: settings.iban,
    account_name: settings.accountName,
    signature_name: settings.signatureName,
    send_individually_by_default: settings.sendIndividuallyByDefault,
    updated_at: new Date().toISOString(),
  };
}

function mapDeclarationFromDb(row) {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount != null ? String(row.amount) : "",
    supplier: row.supplier || "",
    reason: row.reason || "",
    hasReceipt: row.has_receipt ?? true,
    noReceiptReason: row.no_receipt_reason || "",
    note: row.note || "",
    attachment: null,
    attachmentName: row.attachment_name || "",
    attachmentType: row.attachment_type || "",
    attachmentPath: row.attachment_path || "",
    attachmentPublicUrl: row.attachment_public_url || "",
    submitterName: row.submitter_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function mapDeclarationToDb(draft) {
  return {
    id: draft.id,
    date: draft.date,
    amount: Number(String(draft.amount).replace(",", ".")),
    supplier: draft.supplier,
    reason: draft.reason,
    has_receipt: draft.hasReceipt,
    no_receipt_reason: draft.noReceiptReason || null,
    note: draft.note || null,
    attachment_name: draft.attachmentName || null,
    attachment_type: draft.attachmentType || null,
    attachment_path: draft.attachmentPath || null,
    attachment_public_url: draft.attachmentPublicUrl || null,
    submitter_name: draft.submitterName || null,
    created_at: draft.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
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
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [previewState, setPreviewState] = useState({ open: false, groups: [], sendIndividually: false });
  const settingsLoadedRef = useRef(false);
  const settingsAutoSaveTimeoutRef = useRef(null);

  const total = useMemo(
    () => batch.reduce((sum, d) => sum + (Number(String(d.amount).replace(",", ".")) || 0), 0),
    [batch]
  );

  useEffect(() => {
    let active = true;

    async function loadAppData() {
      setIsBootLoading(true);
      try {
        const [settingsRes, batchRes, historyRes] = await Promise.all([
          supabase.from("user_settings").select("*").eq("id", SETTINGS_ROW_ID).maybeSingle(),
          supabase.from("declarations").select("*").order("created_at", { ascending: true }),
          supabase.from("send_history").select("*").order("sent_at", { ascending: false }),
        ]);

        if (settingsRes.error) throw settingsRes.error;
        if (batchRes.error) throw batchRes.error;
        if (historyRes.error) throw historyRes.error;

        if (!active) return;

        setSettings(mapSettingsFromDb(settingsRes.data));
        setBatch((batchRes.data || []).map(mapDeclarationFromDb));
        setHistory((historyRes.data || []).map((row) => ({
          id: row.id,
          sentAt: row.sent_at,
          mode: row.mode,
          subject: row.subject,
          declarations: Array.from({ length: row.declaration_count || 0 }, () => ({})),
        })));

        settingsLoadedRef.current = true;
      } catch (err) {
        console.error(err);
        if (active) {
          setMessage(`Laden uit Supabase mislukt: ${err.message}`);
        }
      } finally {
        if (active) {
          setIsBootLoading(false);
        }
      }
    }

    loadAppData();

    return () => {
      active = false;
      if (settingsAutoSaveTimeoutRef.current) {
        clearTimeout(settingsAutoSaveTimeoutRef.current);
      }
    };
  }, []);
  

  useEffect(() => {
    if (!settingsLoadedRef.current || isBootLoading) return;

    if (settingsAutoSaveTimeoutRef.current) {
      clearTimeout(settingsAutoSaveTimeoutRef.current);
    }

    settingsAutoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await upsertSettings(settings, false);
      } catch (err) {
        console.error(err);
      }
    }, 700);

    return () => {
      if (settingsAutoSaveTimeoutRef.current) {
        clearTimeout(settingsAutoSaveTimeoutRef.current);
      }
    };
  }, [settings, isBootLoading]);

  async function upsertSettings(nextSettings, showFeedback = true) {
    setIsSavingSettings(true);
    const { error } = await supabase.from("user_settings").upsert(mapSettingsToDb(nextSettings), { onConflict: "id" });
    setIsSavingSettings(false);

    if (error) {
      if (showFeedback) setMessage(`Opslaan instellingen mislukt: ${error.message}`);
      throw error;
    }

    if (showFeedback) {
      setMessage("Instellingen opgeslagen in Supabase.");
    }
  }

  async function uploadAttachment(file, declaration) {
    if (!file) {
      return {
        attachmentName: declaration.attachmentName || "",
        attachmentType: declaration.attachmentType || "",
        attachmentPath: declaration.attachmentPath || "",
        attachmentPublicUrl: declaration.attachmentPublicUrl || "",
      };
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const fileName = `${declaration.id}-${Date.now()}.${ext}`;
    const filePath = `receipts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(filePath, file, { upsert: true, contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(filePath);

    return {
      attachmentName: file.name,
      attachmentType: file.type || declaration.attachmentType || "",
      attachmentPath: filePath,
      attachmentPublicUrl: publicUrlData?.publicUrl || "",
    };
  }

  async function removeAttachmentByPath(filePath) {
    if (!filePath) return;
    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([filePath]);
    if (error) {
      console.error("Verwijderen bijlage mislukt:", error.message);
    }
  }

  function openNewDialog() {
    setEditingId(null);
    setDialogError("");
    setDraft(blankDraft());
    setIsDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingId(item.id);
    setDialogError("");
    setDraft({ ...item, attachment: null });
    setIsDialogOpen(true);
  }

  async function saveDraft() {
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

    setIsSavingDraft(true);

    try {
      const previousVersion = editingId ? batch.find((x) => x.id === editingId) : null;
      const attachmentMeta = await uploadAttachment(draft.attachment, draft);

      if (draft.attachment && previousVersion?.attachmentPath && previousVersion.attachmentPath !== attachmentMeta.attachmentPath) {
        await removeAttachmentByPath(previousVersion.attachmentPath);
      }

      const normalized = {
        ...draft,
        ...attachmentMeta,
        attachment: null,
        submitterName: settings.signatureName || "Jorgo",
        amount: String(draft.amount).replace(",", "."),
        createdAt: draft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const payload = mapDeclarationToDb(normalized);
      const { error } = await supabase.from("declarations").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      setBatch((prev) => {
        const next = editingId ? prev.map((x) => (x.id === editingId ? normalized : x)) : [...prev, normalized];
        return next.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
      });

      setMessage(editingId ? "Declaratie bijgewerkt in Supabase." : "Declaratie toegevoegd aan de batch in Supabase.");
      setDialogError("");
      setIsDialogOpen(false);
      setDraft(blankDraft());
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setDialogError(`Opslaan mislukt: ${err.message}`);
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function deleteDraft(id) {
    const item = batch.find((x) => x.id === id);
    try {
      const { error } = await supabase.from("declarations").delete().eq("id", id);
      if (error) throw error;

      if (item?.attachmentPath) {
        await removeAttachmentByPath(item.attachmentPath);
      }

      setBatch((prev) => prev.filter((x) => x.id !== id));
      setMessage("Declaratie verwijderd uit Supabase.");
    } catch (err) {
      console.error(err);
      setMessage(`Verwijderen mislukt: ${err.message}`);
    }
  }

  async function clearBatch() {
    if (!batch.length) return;

    try {
      const filePaths = batch.map((item) => item.attachmentPath).filter(Boolean);
      const { error } = await supabase.from("declarations").delete().neq("id", "__none__");
      if (error) throw error;

      if (filePaths.length) {
        await supabase.storage.from(RECEIPTS_BUCKET).remove(filePaths);
      }

      setBatch([]);
      setMessage("Batch geleegd in Supabase.");
    } catch (err) {
      console.error(err);
      setMessage(`Batch leegmaken mislukt: ${err.message}`);
    }
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

  async function insertHistoryGroup(group, emailData) {
    const historyId = crypto.randomUUID();

    const historyRow = {
      id: historyId,
      sent_at: new Date().toISOString(),
      mode: emailData.mode,
      subject: emailData.subject,
      declaration_count: group.length,
    };

    const { error: historyError } = await supabase.from("send_history").insert(historyRow);
    if (historyError) throw historyError;

    const itemRows = group.map((g, index) => ({
      history_id: historyId,
      declaration_id: g.id,
      date: g.date,
      supplier: g.supplier,
      reason: g.reason,
      amount: Number(String(g.amount).replace(",", ".")),
      has_receipt: g.hasReceipt,
      no_receipt_reason: g.noReceiptReason || null,
      note: g.note || null,
      attachment_name: g.attachmentName || null,
      position: index + 1,
    }));

    const { error: itemsError } = await supabase.from("send_history_items").insert(itemRows);
    if (itemsError) throw itemsError;

    return {
      id: historyId,
      sentAt: historyRow.sent_at,
      mode: historyRow.mode,
      subject: historyRow.subject,
      declarations: group,
    };
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
      const groups = sendIndividually ? batch.map((d) => [d]) : [batch];
      const historyEntries = [];

      for (const group of groups) {
        const emailData = buildEmailData(group, settings);
        const historyEntry = await insertHistoryGroup(group, emailData);
        historyEntries.push(historyEntry);
      }

      const filePaths = batch.map((item) => item.attachmentPath).filter(Boolean);
      const { error: deleteError } = await supabase.from("declarations").delete().neq("id", "__none__");
      if (deleteError) throw deleteError;

      if (filePaths.length) {
        await supabase.storage.from(RECEIPTS_BUCKET).remove(filePaths);
      }

      setHistory((prev) => [...historyEntries, ...prev]);
      setBatch([]);
      setTab("declaraties");
      setMessage("Demo: mail verwerkt, historie opgeslagen in Supabase en batch geleegd.");
    } catch (err) {
      console.error(err);
      setMessage(`Verzenden mislukt: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  }

  async function saveSettingsToSupabase() {
    try {
      await upsertSettings(settings, true);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Declaraties webapp</h1>
            <p className="text-sm text-slate-600">Alle batch-, historie-, settings- en bondata worden nu uit Supabase geladen en daarin opgeslagen.</p>
          </div>
          <Button onClick={openNewDialog} className="rounded-2xl" disabled={isBootLoading}>
            <Plus className="mr-2 h-4 w-4" />Nieuwe declaratie
          </Button>
        </div>

        {message && (
          <Alert className="rounded-2xl">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {isBootLoading && (
          <Alert className="rounded-2xl border-blue-200 bg-blue-50 text-blue-900">
            <AlertDescription>Gegevens worden geladen uit Supabase...</AlertDescription>
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
                  <Button className="w-full rounded-2xl" onClick={() => openPreview(false)} disabled={isSending || batch.length === 0 || isBootLoading}><Eye className="mr-2 h-4 w-4" />Bekijk batchmail</Button>
                  <Button className="w-full rounded-2xl" variant="secondary" onClick={() => openPreview(true)} disabled={isSending || batch.length === 0 || isBootLoading}><Eye className="mr-2 h-4 w-4" />Bekijk losse mails</Button>
                  <Button className="w-full rounded-2xl" variant="outline" onClick={clearBatch} disabled={isSending || batch.length === 0 || isBootLoading}><Trash2 className="mr-2 h-4 w-4" />Batch leegmaken</Button>
                  <p className="text-xs text-slate-500">Ook batch leegmaken, verwijderen, bewerken en historie-opbouw lopen nu via Supabase.</p>
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
                    Let op: deze versie schrijft SMTP-instellingen ook weg naar Supabase. Voor productie is dat alleen verantwoord met auth, RLS en idealiter secrets op de server.
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

                <Button className="rounded-2xl" onClick={saveSettingsToSupabase} disabled={isSavingSettings || isBootLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingSettings ? "Opslaan..." : "Opslaan"}
                </Button>
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
              <Button onClick={saveDraft} disabled={isSavingDraft}>{isSavingDraft ? "Opslaan..." : "Opslaan"}</Button>
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