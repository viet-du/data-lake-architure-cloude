import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  EmptyState,
  ErrorBoundary,
  ScreenError,
  ScreenLoading,
  ScreenPageHeader,
  ScreenSection,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  SamplePreview,
  EdaChartGrid,
  EdaProfileLibrary,
  EdaProfileRequestForm,
  EdaProfileSummary,
  EdaProposeRuleModal,
} from '@/components';
import {
  useEdaProfileChartsQuery,
  useEdaProfileQuery,
  useEdaProfileSampleQuery,
  useEdaProfilesQuery,
} from '@/services/queries';
import { useToast } from '@/hooks';
import { ROUTES } from '@/navigation/routes';
import type { EColumnProfile } from '@/types/entities';

/**
 * The EDA screen.
 *
 * The flow is the master plan's flow: pick a dataset → profile it → read
 * the findings → turn a finding into a DQ rule. Every step references the
 * *same* profile snapshot, so the chart and the proposed rule always agree
 * about which data they describe.
 */

type EdaTab = 'explore' | 'charts' | 'sample';

export function EdaView() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<EdaTab>('explore');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [proposeColumn, setProposeColumn] = useState<EColumnProfile | null>(null);

  const profilesQuery = useEdaProfilesQuery({ limit: 50 });
  const profileQuery = useEdaProfileQuery(selectedProfileId ?? '');
  const chartsQuery = useEdaProfileChartsQuery(selectedProfileId ?? '');
  const sampleQuery = useEdaProfileSampleQuery(selectedProfileId ?? '', 20);

  const columns = useMemo(
    () => profileQuery.data?.columns ?? [],
    [profileQuery.data],
  );

  function handleSelectProfile(profileId: string): void {
    setSelectedProfileId(profileId);
  }

  function handlePropose(column: EColumnProfile): void {
    setProposeColumn(column);
  }

  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="Analyst"
          titleKey="screens.eda.title"
          subtitleKey="screens.eda.subtitle"
          descriptionKey="screens.eda.description"
          accent="dq"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`${ROUTES.DQ}?source=eda`)}
              >
                {t('eda.toDataQuality')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setRequestOpen(true)}>
                {t('eda.runProfile')}
              </Button>
            </>
          }
        />

        <div className="flex-1 overflow-hidden">
          <TabsRoot value={tab} onValueChange={(value) => setTab(value as EdaTab)}>
            {/* The tab bar MUST live inside `TabsRoot`: `TabsTrigger` reads
                the tabs context and throws when the provider is absent. */}
            <TabsList>
              <TabsTrigger value="explore">{t('eda.tab.explore')}</TabsTrigger>
              <TabsTrigger value="charts">{t('eda.tab.charts')}</TabsTrigger>
              <TabsTrigger value="sample">{t('eda.tab.sample')}</TabsTrigger>
            </TabsList>

            <TabsContent value="explore">
              <ScreenSection title={t('eda.exploreTitle')} padded={false}>
                <div className="p-4">
                  {selectedProfileId === null ? (
                    <EmptyState
                      title={t('eda.noSelection')}
                      description={t('eda.noSelectionDescription')}
                      action={
                        <Button variant="primary" size="sm" onClick={() => setRequestOpen(true)}>
                          {t('eda.runProfile')}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {profileQuery.data !== undefined ? (
                        <EdaProfileSummary profile={profileQuery.data} />
                      ) : null}
                      <EdaProfileLibrary
                        profiles={profilesQuery.data}
                        isLoading={profilesQuery.isLoading}
                        isError={profilesQuery.isError}
                        error={profilesQuery.error}
                        onRetry={() => void profilesQuery.refetch()}
                        selectedProfileId={selectedProfileId}
                        onSelectProfile={handleSelectProfile}
                        columns={columns}
                        isColumnsLoading={profileQuery.isLoading}
                        onProposeRule={handlePropose}
                      />
                    </div>
                  )}
                </div>
              </ScreenSection>
            </TabsContent>

            <TabsContent value="charts">
              <ScreenSection title={t('eda.chartsTitle')} padded={false}>
                <div className="p-4">
                  {selectedProfileId === null ? (
                    <EmptyState title={t('eda.noSelection')} description={t('eda.noSelectionDescription')} />
                  ) : chartsQuery.isLoading ? (
                    <ScreenLoading rows={4} />
                  ) : chartsQuery.isError ? (
                    <ScreenError
                      error={chartsQuery.error}
                      onRetry={() => void chartsQuery.refetch()}
                      compact
                    />
                  ) : (chartsQuery.data ?? []).length === 0 ? (
                    <EmptyState title={t('eda.noCharts')} />
                  ) : (
                    <EdaChartGrid
                      charts={chartsQuery.data ?? []}
                      onProposeRule={(columnName) => {
                        const column = columns.find((item) => item.name === columnName);
                        if (column !== undefined) handlePropose(column);
                      }}
                    />
                  )}
                </div>
              </ScreenSection>
            </TabsContent>

            <TabsContent value="sample">
              <ScreenSection title={t('eda.sampleTitle')} padded={false}>
                <div className="p-4">
                  {selectedProfileId === null ? (
                    <EmptyState title={t('eda.noSelection')} description={t('eda.noSelectionDescription')} />
                  ) : sampleQuery.isLoading ? (
                    <ScreenLoading rows={4} />
                  ) : sampleQuery.isError ? (
                    <ScreenError
                      error={sampleQuery.error}
                      onRetry={() => void sampleQuery.refetch()}
                      compact
                    />
                  ) : (
                    <SamplePreview
                      columns={columns.map((column) => column.name)}
                      rows={sampleQuery.data?.rows ?? []}
                      isLoading={false}
                      isError={false}
                      maxRows={20}
                    />
                  )}
                </div>
              </ScreenSection>
            </TabsContent>
          </TabsRoot>
        </div>

        <EdaProfileRequestForm
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          onCreated={(profileId) => {
            setSelectedProfileId(profileId);
            toast.success(t('eda.profileCreated', { id: profileId }));
          }}
        />
        <EdaProposeRuleModal
          open={proposeColumn !== null}
          onClose={() => setProposeColumn(null)}
          profileId={selectedProfileId ?? ''}
          column={proposeColumn}
          onProposed={() => {
            toast.info(t('eda.ruleDrafted'));
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
