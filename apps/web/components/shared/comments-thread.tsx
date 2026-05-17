"use client";

import { useEffect, useState } from "react";
import { Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listComments,
  createComment,
  deleteComment,
  type Comment,
  type CommentEntityType,
} from "@/lib/actions";
import { EmptyState } from "./empty-state";

export interface CommentsThreadProps {
  entityType: CommentEntityType;
  entityId: string;
  /** Current user id — used to enable delete on own comments. */
  currentUserId?: string;
}

export function CommentsThread({ entityType, entityId, currentUserId }: CommentsThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    listComments({ entityType, entityId }).then((r) => {
      if (r.ok) setComments(r.data);
      setLoading(false);
    });
  };

  useEffect(refresh, [entityType, entityId]);

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    const result = await createComment({ entityType, entityId, body });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setBody("");
    if (result.data.mentions.length > 0) {
      toast.success(`${result.data.mentions.length} kişi bilgilendirildi`);
    }
    refresh();
  };

  const handleDelete = async (id: string) => {
    const r = await deleteComment({ commentId: id });
    if (r.ok) refresh();
    else toast.error(r.error.message);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Yorum yaz… @kullanici-adi ile birini etiketleyebilirsin"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            ⌘/Ctrl+Enter ile gönder
          </p>
          <Button size="sm" onClick={submit} disabled={!body.trim() || submitting}>
            {submitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            Gönder
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Henüz yorum yok"
          description="İlk yorumu siz yazın."
        />
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-card p-3 group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.userName ?? "Bilinmeyen"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {c.mentions.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      @{c.mentions.length}
                    </Badge>
                  )}
                </div>
                {c.userId === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
