import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useListCaseNotes, useCreateCaseNote, useDeleteCaseNote, useListParticipants, useListStaff } from "@workspace/api-client-react";
import { getListCaseNotesQueryKey } from "@workspace/api-client-react";
import type { Participant, StaffMember, CaseNote } from "@/types/entities";
import { Plus, BookOpen, Lock, AlertCircle, Trash2, Sparkles, CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const noteSchema = z.object({
  participantId: z.number({ required_error: "Required" }),
  staffId: z.number({ required_error: "Required" }),
  noteType: z.enum(["shift_note", "progress_note", "handover", "communication", "medical", "general"]),
  content: z.string().min(1, "Required"),
  goalReference: z.string().optional(),
  isPrivate: z.boolean().default(false),
  requiresFollowUp: z.boolean().default(false),
  followUpDate: z.string().optional(),
});

type NoteForm = z.infer<typeof noteSchema>;

const NOTE_TYPE_LABELS: Record<string, string> = {
  shift_note: "Shift Note",
  progress_note: "Progress Note",
  handover: "Handover",
  communication: "Communication",
  medical: "Medical",
  general: "General",
};

export default function CaseNotes() {
  const [showCreate, setShowCreate] = useState(false);
  const [participantFilter, setParticipantFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState<{ enhanced: string; keyPoints: string[]; requiresFollowUp: boolean; followUpReason: string | null } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: participants } = useListParticipants();
  const { data: staff } = useListStaff();

  const params = {
    ...(participantFilter !== "all" ? { participantId: parseInt(participantFilter, 10) } : {}),
    ...(typeFilter !== "all" ? { noteType: typeFilter as "shift_note" | "progress_note" | "handover" | "communication" | "medical" | "general" } : {}),
  };

  const { data: notes, isLoading } = useListCaseNotes(params);
  const createNote = useCreateCaseNote();
  const deleteNote = useDeleteCaseNote();

  const form = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      noteType: "general",
      content: "",
      isPrivate: false,
      requiresFollowUp: false,
    },
  });

  const handleEnhanceWithAI = async () => {
    const content = form.getValues("content");
    const noteType = form.getValues("noteType");
    const participantId = form.getValues("participantId");
    if (!content || content.trim().length < 5) {
      toast({ title: "Write something first before enhancing", variant: "destructive" });
      return;
    }
    setAiEnhancing(true);
    setAiEnhanced(null);
    try {
      const res = await fetchWithAuth("/api/ai/process-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, noteType, participantId }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      setAiEnhanced(data);
    } catch {
      toast({ title: "AI enhancement failed", variant: "destructive" });
    } finally {
      setAiEnhancing(false);
    }
  };

  const applyAIEnhancement = () => {
    if (!aiEnhanced) return;
    form.setValue("content", aiEnhanced.enhanced);
    if (aiEnhanced.requiresFollowUp) form.setValue("requiresFollowUp", true);
    setAiEnhanced(null);
    toast({ title: "Note enhanced with AI" });
  };

  const onSubmit = (data: NoteForm) => {
    createNote.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Case note added" });
        setShowCreate(false);
        form.reset();
        setAiEnhanced(null);
        queryClient.invalidateQueries({ queryKey: getListCaseNotesQueryKey() });
      },
      onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this note?")) return;
    deleteNote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Note deleted" });
        queryClient.invalidateQueries({ queryKey: getListCaseNotesQueryKey() });
      },
    });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Case Notes</h1>
          <p className="pf-page-desc">{notes?.length ?? 0} notes recorded</p>
        </div>
        <Button data-testid="button-add-note" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      <div className="pf-filter-bar">
        <Select value={participantFilter} onValueChange={setParticipantFilter}>
          <SelectTrigger data-testid="select-note-participant" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Participants</SelectItem>
            {(participants as Participant[] | undefined)?.map((p: Participant) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger data-testid="select-note-type" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(NOTE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="pf-card" style={{ padding: 16 }}>
              <div className="pf-skeleton" style={{ height: 14, width: 200, marginBottom: 8 }} />
              <div className="pf-skeleton" style={{ height: 60 }} />
            </div>
          ))
        ) : notes?.length === 0 ? (
          <div className="pf-card">
            <div className="pf-empty">
              <BookOpen className="pf-empty-icon" />
              <p>No case notes found</p>
            </div>
          </div>
        ) : (
          (notes as CaseNote[] | undefined)?.map((note: CaseNote) => (
            <div key={note.id} data-testid={`note-card-${note.id}`} className="pf-card" style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--pf-ai-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--pf-primary)" }}>{note.staffName?.charAt(0) ?? "?"}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <StatusBadge status={note.noteType} />
                      <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>{note.participantName}</span>
                      <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>· {note.staffName}</span>
                      <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>· {note.createdAt?.slice(0, 10)}</span>
                      {note.isPrivate && (
                        <span className="pf-chip" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Lock style={{ width: 10, height: 10 }} /> Private
                        </span>
                      )}
                      {note.requiresFollowUp && (
                        <span className="pf-chip pf-chip-warning" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <AlertCircle style={{ width: 10, height: 10 }} /> Follow-up {note.followUpDate ? `by ${note.followUpDate}` : ""}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--pf-text-soft)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{note.content}</p>
                    {note.goalReference && (
                      <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 6 }}>Goal reference: {note.goalReference}</p>
                    )}
                  </div>
                </div>
                <button data-testid={`button-delete-note-${note.id}`} onClick={() => handleDelete(note.id)} className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7, color: "var(--pf-error)", borderColor: "transparent", flexShrink: 0 }}>
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Case Note</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="participantId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v, 10))}>
                      <FormControl><SelectTrigger data-testid="select-note-participant-form"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(participants as Participant[] | undefined)?.map((p: Participant) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="staffId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Author</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v, 10))}>
                      <FormControl><SelectTrigger data-testid="select-note-staff-form"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(staff as StaffMember[] | undefined)?.map((s: StaffMember) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="noteType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-note-type-form"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(NOTE_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-1.5">
                    <FormLabel className="mb-0">Note Content</FormLabel>
                    <button
                      type="button"
                      onClick={handleEnhanceWithAI}
                      disabled={aiEnhancing}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[10px] border border-cyan-200 bg-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ color: "#0F172A", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                      onMouseEnter={e => !aiEnhancing && ((e.currentTarget as HTMLElement).style.backgroundColor = "#ECFEFF")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "white")}
                    >
                      {aiEnhancing
                        ? <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#3EC1D3", borderTopColor: "transparent" }} />
                        : <Sparkles className="w-3 h-3" style={{ color: "#3EC1D3" }} />}
                      {aiEnhancing ? "Improving note…" : "✨ Improve Note"}
                    </button>
                  </div>
                  <FormControl>
                    <Textarea data-testid="input-note-content" rows={4} placeholder="Write rough notes — e.g. 'client was calm, went for a walk, had lunch'" {...field} />
                  </FormControl>
                  <FormMessage />

                  {/* AI Loading */}
                  {aiEnhancing && (
                    <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: "#3EC1D3", borderTopColor: "transparent" }} />
                      <span className="text-xs" style={{ color: "#6B7280" }}>Generating suggestions…</span>
                    </div>
                  )}

                  {/* AI Enhanced Preview */}
                  {aiEnhanced && !aiEnhancing && (
                    <div className="mt-2 rounded-xl border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100" style={{ backgroundColor: "#ECFEFF" }}>
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" style={{ color: "#3EC1D3" }} />
                          <span className="text-xs font-semibold" style={{ color: "#3EC1D3" }}>AI Generated</span>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-cyan-200" style={{ color: "#3EC1D3", backgroundColor: "white" }}>Preview</span>
                      </div>

                      {/* Enhanced content */}
                      <div className="px-4 py-3 space-y-3">
                        <p className="text-sm leading-relaxed" style={{ color: "#0F172A" }}>{aiEnhanced.enhanced}</p>

                        {aiEnhanced.keyPoints.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {aiEnhanced.keyPoints.map((pt, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full border border-cyan-200 bg-cyan-50" style={{ color: "#3EC1D3" }}>{pt}</span>
                            ))}
                          </div>
                        )}

                        {aiEnhanced.requiresFollowUp && (
                          <div className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 bg-amber-50 border border-amber-100 text-amber-700">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>AI recommends follow-up{aiEnhanced.followUpReason ? `: ${aiEnhanced.followUpReason}` : ""}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                        <button
                          type="button"
                          onClick={applyAIEnhancement}
                          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-[10px] text-white transition-all duration-200 active:scale-[0.98]"
                          style={{ backgroundColor: "#3EC1D3" }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "#2BB3C5")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "#3EC1D3")}
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiEnhanced(null)}
                          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-[10px] border border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 active:scale-[0.98]"
                          style={{ color: "#6B7280" }}
                        >
                          <RotateCcw className="w-3 h-3" /> Discard
                        </button>
                      </div>
                    </div>
                  )}
                </FormItem>
              )} />
              <FormField control={form.control} name="goalReference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Reference (optional)</FormLabel>
                  <FormControl><Input data-testid="input-goal-reference" placeholder="e.g. Goal 2 - Social participation" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-6">
                <FormField control={form.control} name="isPrivate" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox data-testid="checkbox-private" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Private note</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="requiresFollowUp" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox data-testid="checkbox-followup" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Requires follow-up</FormLabel>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button data-testid="button-submit-note" type="submit" disabled={createNote.isPending}>
                  {createNote.isPending ? "Saving..." : "Save Note"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
