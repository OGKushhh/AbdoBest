import React from 'react';
import {
  View, Modal, TouchableOpacity, Text, StyleSheet,
  ScrollView, Dimensions, Image,
} from 'react-native';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {useTranslation} from 'react-i18next';
import {ReleaseInfo, DownloadProgress} from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  release: ReleaseInfo | null;
  currentVersion: string;
  downloading?: boolean;
  progress?: DownloadProgress | null;
  onDownload: (url: string) => void;
  onSkip: (version: string) => void;
  onDismiss: () => void;
}

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// ── Lightweight markdown parser for GitHub release changelogs ────────────────
// Handles the most common markdown patterns found in release notes:
//   ## Header      → bold, larger text
//   ### Subheader  → bold, medium text
//   - item / * item → bullet point with proper indentation
//   **bold**       → bold (stripped, rendered as bold Text)
//   `code`         → stripped of backticks
//   ``` blocks     → skipped (code fences)
//   Regular text   → paragraph
// No external dependency — just string parsing + React Native components.
interface ChangelogBlock {
  type: 'header' | 'subheader' | 'bullet' | 'paragraph';
  content: string;
  items?: string[];
}

function parseChangelog(markdown: string): ChangelogBlock[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const blocks: ChangelogBlock[] = [];
  let currentBullets: string[] = [];
  let inCodeFence = false;

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      blocks.push({ type: 'bullet', content: '', items: [...currentBullets] });
      currentBullets = [];
    }
  };

  // Strip inline markdown: **bold** → bold, *italic* → italic, `code` → code
  const stripInline = (text: string): string =>
    text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [text](url) → text
      .trim();

  for (const line of lines) {
    const trimmed = line.trim();

    // Toggle code fence
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      flushBullets();
      continue;
    }
    // Skip content inside code fences
    if (inCodeFence) continue;

    if (!trimmed) {
      flushBullets();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushBullets();
      blocks.push({ type: 'header', content: stripInline(trimmed.slice(3)) });
    } else if (trimmed.startsWith('### ')) {
      flushBullets();
      blocks.push({ type: 'subheader', content: stripInline(trimmed.slice(4)) });
    } else if (trimmed.startsWith('# ')) {
      flushBullets();
      blocks.push({ type: 'header', content: stripInline(trimmed.slice(2)) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentBullets.push(stripInline(trimmed.slice(2)));
    } else {
      flushBullets();
      blocks.push({ type: 'paragraph', content: stripInline(trimmed) });
    }
  }
  flushBullets();
  return blocks;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible, release, currentVersion, downloading, progress, onDownload, onSkip, onDismiss,
}) => {
  const {t} = useTranslation();

  if (!release) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Image source={require('../../assets/icons/sync.png')} style={{width: 32, height: 32, tintColor: Colors.dark.primary}} />
            </View>
            <Text style={styles.title}>{t('update_available')}</Text>
            <Text style={styles.subtitle}>{t('update_description')}</Text>
          </View>

          {/* Version info */}
          <View style={styles.versionRow}>
            <View style={styles.versionBox}>
              <Text style={styles.versionLabel}>{t('current_version')}</Text>
              <Text style={styles.versionValue}>v{currentVersion}</Text>
            </View>
            <Image source={require('../../assets/icons/arrow.png')} style={{width: 20, height: 20, tintColor: Colors.dark.textMuted}} />
            <View style={[styles.versionBox, styles.versionBoxNew]}>
              <Text style={styles.versionLabel}>{t('latest_version')}</Text>
              <Text style={[styles.versionValue, {color: Colors.dark.primary}]}>v{release.version}</Text>
            </View>
          </View>

          {/* Changelog */}
          {release.changelog && (
            <View style={styles.changelogContainer}>
              <Text style={styles.changelogTitle}>{t('update_changelog')}</Text>
              <ScrollView style={styles.changelogScroll} showsVerticalScrollIndicator={false}>
                {parseChangelog(release.changelog).map((block, i) => {
                  switch (block.type) {
                    case 'header':
                      return <Text key={i} style={styles.clHeader}>{block.content}</Text>;
                    case 'subheader':
                      return <Text key={i} style={styles.clSubheader}>{block.content}</Text>;
                    case 'bullet':
                      return (
                        <View key={i} style={styles.clBulletGroup}>
                          {(block.items || []).map((item, j) => (
                            <View key={j} style={styles.clBulletRow}>
                              <Text style={styles.clBulletDot}>{'\u2022'}</Text>
                              <Text style={styles.clBulletText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    case 'paragraph':
                    default:
                      return <Text key={i} style={styles.clParagraph}>{block.content}</Text>;
                  }
                })}
              </ScrollView>
            </View>
          )}

          {/* Date */}
          <Text style={styles.dateText}>
            {formatDate(release.publishedAt)}
          </Text>

          {/* Actions */}
          {downloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {width: `${progress?.percent ?? 0}%`}]} />
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressPercent}>{progress?.percent ?? 0}%</Text>
                {!!progress?.bytesPerSecond && (
                  <Text style={styles.progressSpeed}>{formatBytes(progress.bytesPerSecond)}/s</Text>
                )}
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => onDownload(release.downloadUrl)}
              >
                <Image source={require('../../assets/icons/download-to-storage-drive.png')} style={{width: 22, height: 22, tintColor: '#fff'}} />
                <Text style={styles.downloadButtonText}>{t('download_update')}</Text>
              </TouchableOpacity>

              <View style={styles.bottomRow}>
                <TouchableOpacity style={styles.skipButton} onPress={() => onSkip(release.version)}>
                  <Text style={styles.skipText}>{t('skip_version')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
                  <Text style={styles.laterText}>{t('later')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.dark.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 4,
    textAlign: 'center',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  versionBox: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
  },
  versionBoxNew: {
    borderColor: Colors.dark.primary,
    borderWidth: 1,
  },
  versionLabel: {
    color: Colors.dark.textMuted,
    fontSize: Typography.sizes.xs,
    marginBottom: 4,
  },
  versionValue: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  changelogContainer: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  changelogTitle: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginBottom: 8,
  },
  changelogScroll: {
    maxHeight: SCREEN_HEIGHT * 0.3,
  },
  // ── Markdown-rendered changelog styles ──
  clHeader: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Rubik-Bold',
    marginTop: 12,
    marginBottom: 4,
  },
  clSubheader: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Rubik',
    marginTop: 8,
    marginBottom: 4,
  },
  clBulletGroup: {
    marginBottom: 4,
  },
  clBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
    paddingLeft: 4,
  },
  clBulletDot: {
    color: Colors.dark.primary,
    fontSize: 13,
    lineHeight: 18,
    marginRight: 8,
    flexShrink: 0,
  },
  clBulletText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontFamily: 'Rubik',
  },
  clParagraph: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    fontFamily: 'Rubik',
  },
  dateText: {
    color: Colors.dark.textMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginBottom: 16,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginLeft: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.dark.primary,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressPercent: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  progressSpeed: {
    color: Colors.dark.textMuted,
    fontSize: Typography.sizes.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.md,
  },
  laterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  laterText: {
    color: Colors.dark.primary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semibold,
  },
});
