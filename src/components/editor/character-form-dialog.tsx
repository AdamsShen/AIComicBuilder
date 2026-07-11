"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface CharacterFormDialogProps {
  projectId: string;
  /** 可选：新增为某分集的配角（不传则建为项目级主角） */
  episodeId?: string;
  onCreated: () => void;
}

/**
 * 手动新增项目级角色的对话框（含性别、与主角关系等字段）。
 * 角色一律入项目级共享池，作为跨分集记忆的一部分。
 */
export function CharacterFormDialog({
  projectId,
  episodeId,
  onCreated,
}: CharacterFormDialogProps) {
  const tChar = useTranslations("character");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [relationToLead, setRelationToLead] = useState("");
  const [description, setDescription] = useState("");
  const [visualHint, setVisualHint] = useState("");
  const [scope, setScope] = useState<"main" | "guest">(episodeId ? "guest" : "main");

  function reset() {
    setName("");
    setGender("");
    setRelationToLead("");
    setDescription("");
    setVisualHint("");
    setScope(episodeId ? "guest" : "main");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error(tChar("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          relationToLead,
          description,
          visualHint,
          scope,
          episodeId: scope === "guest" ? episodeId ?? null : null,
        }),
      });
      toast.success(tc("saved"));
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5" />
        {tChar("addCharacter")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tChar("addCharacter")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tChar("namePlaceholder")}
            />
            <div className="flex gap-2">
              <Input
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder={tChar("gender")}
                className="flex-1"
              />
              <Input
                value={relationToLead}
                onChange={(e) => setRelationToLead(e.target.value)}
                placeholder={tChar("relationToLead")}
                className="flex-[2]"
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tChar("description")}
              className="h-24 resize-none"
            />
            <Input
              value={visualHint}
              onChange={(e) => setVisualHint(e.target.value)}
              placeholder={tChar("visualHint")}
            />
            {episodeId && (
              <label className="flex items-center gap-2 text-xs text-[--text-muted]">
                <input
                  type="checkbox"
                  checked={scope === "guest"}
                  onChange={(e) => setScope(e.target.checked ? "guest" : "main")}
                />
                {tChar("asEpisodeGuest")}
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
