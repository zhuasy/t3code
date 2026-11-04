import { useAtomValue } from "@effect/atom-react";
import { type EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { useState } from "react";
import { Linking, Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { serverEnvironment } from "../../state/server";
import { composerPullRequests } from "../../state/pull-requests";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";

function ReviewState({
  environmentId,
  instanceId,
  prUrl,
  onViewComments,
}: {
  environmentId: EnvironmentId;
  instanceId: ProviderInstanceId;
  prUrl: string;
  onViewComments: () => void;
}) {
  const input = { instanceId, prUrl };
  const query = useEnvironmentQuery(composerPullRequests.devinReview({ environmentId, input }));
  const start = useAtomCommand(composerPullRequests.startDevinReview, { reportFailure: false });
  const canStart = useAtomValue(
    composerPullRequests.startDevinReview.permissionAtom(environmentId),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = query.data?.status === "pending" || query.data?.status === "running";
  const request = async () => {
    if (!canStart || pending || running) return;
    setPending(true);
    setError(null);
    const result = await start({ environmentId, input });
    setPending(false);
    if (result._tag === "Success") query.refresh();
    else setError("Could not start the review. Check the Devin connection and try again.");
  };
  const pr = new URL(prUrl);
  const hostedUrl =
    pr.hostname === "github.com"
      ? `https://devinreview.com${pr.pathname}`
      : "https://app.devin.ai/review";
  return (
    <View className="gap-4">
      <Text accessibilityRole="text">
        {query.isPending && !query.data
          ? "Checking review…"
          : query.data
            ? `Review ${query.data.status}`
            : query.error
              ? "Review status unavailable"
              : "No review for the current PR head."}
      </Text>
      {query.data ? <Text>Commit: {query.data.commit_sha.slice(0, 12)}</Text> : null}
      {error || query.error ? <Text accessibilityRole="alert">{error ?? query.error}</Text> : null}
      <Button
        label={
          pending
            ? "Starting…"
            : running
              ? "Review in progress"
              : query.data
                ? "Review again"
                : "Start review"
        }
        disabled={!canStart || pending || running || query.isPending || query.error !== null}
        onPress={() => void request()}
      />
      <Button label="Refresh" disabled={pending || query.isPending} onPress={query.refresh} />
      <Button label="View PR comments" onPress={onViewComments} />
      <Button
        label="Open findings in Devin"
        onPress={() =>
          void Linking.openURL(hostedUrl).catch(() => setError("Could not open Devin Review."))
        }
      />
      <Text className="text-foreground-muted">
        Detailed findings are available in Devin and in comments it posts to this PR.
      </Text>
    </View>
  );
}

export function DevinReviewSheet({
  environmentId,
  prUrl,
  onClose,
  onViewComments,
}: {
  environmentId: EnvironmentId;
  prUrl: string;
  onClose: () => void;
  onViewComments: () => void;
}) {
  const settings = useAtomValue(serverEnvironment.settingsValueAtom(environmentId));
  const [selected, setSelected] = useState<string | null>(null);
  const instances = Object.entries(settings?.providerInstances ?? {}).filter(([, instance]) => {
    const config = instance.config;
    return (
      instance.driver === "acpRegistry" &&
      instance.enabled !== false &&
      config !== null &&
      typeof config === "object" &&
      "agentId" in config &&
      config.agentId === "devin" &&
      !("source" in config && config.source === "local")
    );
  });
  const instanceId = instances.find(([id]) => id === selected)?.[0] ?? instances[0]?.[0];
  return (
    <Modal visible onRequestClose={onClose} presentationStyle="pageSheet" animationType="slide">
      <SafeAreaView className="flex-1 bg-screen">
        <ScrollView contentContainerClassName="gap-5 p-5">
          <Text className="text-xl font-t3-medium">Devin Review</Text>
          <Button label="Done" tone="text" onPress={onClose} />
          {instances.length > 1
            ? instances.map(([id, instance]) => (
                <Button
                  key={id}
                  label={`${id === instanceId ? "✓ " : ""}${instance.displayName ?? id}`}
                  onPress={() => setSelected(id)}
                />
              ))
            : null}
          {instanceId ? (
            <ReviewState
              key={instanceId}
              environmentId={environmentId}
              instanceId={ProviderInstanceId.make(instanceId)}
              prUrl={prUrl}
              onViewComments={onViewComments}
            />
          ) : (
            <Text>
              Add Devin Cloud in Settings → Providers and configure its organization ID and API
              token.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
