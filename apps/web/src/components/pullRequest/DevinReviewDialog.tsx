import { useAtomValue } from "@effect/atom-react";
import { type EnvironmentId, ProviderInstanceId, type ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { useOpenLink } from "~/browser/useOpenLink";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";
import { useLiveRefresh } from "~/hooks/useLiveRefresh";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogPopup,
} from "../ui/dialog";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";

function ReviewStatus({
  environmentId,
  instanceId,
  prUrl,
  threadRef,
  onViewComments,
}: {
  environmentId: EnvironmentId;
  instanceId: ProviderInstanceId;
  prUrl: string;
  threadRef: ScopedThreadRef | null;
  onViewComments: () => void;
}) {
  const input = { instanceId, prUrl };
  const query = useEnvironmentQuery(pullRequestEnvironment.devinReview({ environmentId, input }));
  const start = useAtomCommand(pullRequestEnvironment.startDevinReview, { reportFailure: false });
  const canStart = useAtomValue(
    pullRequestEnvironment.startDevinReview.permissionAtom(environmentId),
  );
  const openLink = useOpenLink(threadRef);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = query.data?.status;
  const running = status === "pending" || status === "running";
  useLiveRefresh(running ? query.refresh : null, {
    key: `devin-review:${environmentId}:${instanceId}:${prUrl}`,
  });
  const startReview = async () => {
    if (pending || !canStart || running) return;
    setPending(true);
    setError(null);
    const result = await start({ environmentId, input });
    setPending(false);
    if (result._tag === "Success") query.refresh();
    else setError("Could not start the review. Check the Devin connection and try again.");
  };
  const reviewUrl = new URL(prUrl);
  const hostedUrl =
    reviewUrl.hostname === "github.com"
      ? `https://devinreview.com${reviewUrl.pathname}`
      : "https://app.devin.ai/review";
  return (
    <div className="grid gap-4">
      <p role="status" className="text-sm">
        {query.isPending && !query.data
          ? "Checking Devin Review…"
          : status
            ? `Review ${status}`
            : query.error
              ? "Review status unavailable"
              : "No review for the current PR head."}
      </p>
      {query.data ? (
        <dl className="grid gap-1 text-sm text-muted-foreground">
          <div>
            <dt className="inline">Commit: </dt>
            <dd className="inline font-mono">{query.data.commit_sha.slice(0, 12)}</dd>
          </div>
          <div>
            <dt className="inline">Requested: </dt>
            <dd className="inline">{new Date(query.data.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      ) : null}
      {error || query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {error ?? query.error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Detailed findings are available in Devin and in comments it posts to this PR.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!canStart || pending || running || query.isPending || query.error !== null}
          onClick={() => void startReview()}
        >
          {pending
            ? "Starting…"
            : running
              ? "Review in progress"
              : status
                ? "Review again"
                : "Start review"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isPending || pending}
          onClick={query.refresh}
        >
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={onViewComments}>
          View PR comments
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            void openLink(hostedUrl).catch(() => setError("Could not open Devin Review."))
          }
        >
          Open findings in Devin
        </Button>
      </div>
    </div>
  );
}

export function DevinReviewButton({
  environmentId,
  prUrl,
  threadRef,
  onViewComments,
}: {
  environmentId: EnvironmentId;
  prUrl: string;
  threadRef: ScopedThreadRef | null;
  onViewComments: () => void;
}) {
  const settings = useEnvironmentSettings(environmentId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const instances = Object.entries(settings.providerInstances).filter(([, instance]) => {
    const config = instance.config;
    return (
      instance.enabled !== false &&
      instance.driver === "acpRegistry" &&
      config !== null &&
      typeof config === "object" &&
      "agentId" in config &&
      config.agentId === "devin" &&
      !("source" in config && config.source === "local")
    );
  });
  const instanceId = instances.find(([id]) => id === selected)?.[0] ?? instances[0]?.[0];
  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setOpen(true)}>
        Devin Review
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devin Review</DialogTitle>
            <DialogDescription>Run a hosted review of the current pull request.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="grid gap-4">
              {instances.length > 1 ? (
                <Select value={instanceId} onValueChange={setSelected}>
                  <SelectTrigger aria-label="Devin account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {instances.map(([id, instance]) => (
                      <SelectItem key={id} value={id}>
                        {instance.displayName ?? id}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              ) : null}
              {open && instanceId ? (
                <ReviewStatus
                  key={`${environmentId}:${instanceId}:${prUrl}`}
                  environmentId={environmentId}
                  instanceId={ProviderInstanceId.make(instanceId)}
                  prUrl={prUrl}
                  threadRef={threadRef}
                  onViewComments={() => {
                    setOpen(false);
                    onViewComments();
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add Devin Cloud in Settings → Providers, then configure its organization ID and
                  API token for hosted reviews.
                </p>
              )}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
