import type { FileSystemTree } from '@webcontainer/api';
import type { ProjectTemplate } from '$lib/projects/types';
import expoWcPreload from './expoWcPreload.cjs?raw';
import expoDevScript from './expoDev.cjs?raw';

export { EXPO_COMPAT_VERSION, EXPO_DEV_SCRIPT } from './expoConstants';
import { EXPO_COMPAT_VERSION, EXPO_DEV_SCRIPT } from './expoConstants';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

/** Bolt-style Expo 53 stack aligned with WebContainer ws-tunnel (default port 8081). */
const packageJson = {
	name: 'expo-repl',
	private: true,
	version: '1.0.0',
	main: 'expo-router/entry',
	scripts: {
		dev: EXPO_DEV_SCRIPT,
		start: 'expo start',
		android: 'expo start --android',
		ios: 'expo start --ios',
		web: 'expo start --web'
	},
	dependencies: {
		'expo-constants': '~17.1.3',
		'expo-linking': '~7.1.3',
		expo: '~53.0.0',
		'expo-router': '~5.0.2',
		'expo-status-bar': '~2.2.2',
		react: '19.0.0',
		'react-dom': '19.0.0',
		'react-native': '0.79.1',
		'react-native-safe-area-context': '5.3.0',
		'react-native-screens': '~4.10.0',
		'react-native-web': '~0.20.0'
	},
	devDependencies: {
		'@babel/core': '^7.25.2',
		'@types/react': '~19.0.10',
		typescript: '~5.8.3'
	}
};

const appJson = {
	expo: {
		name: 'expo-repl',
		slug: 'expo-repl',
		version: '1.0.0',
		orientation: 'portrait',
		scheme: 'expo-repl',
		userInterfaceStyle: 'automatic',
		web: {
			bundler: 'metro',
			output: 'single'
		},
		plugins: ['expo-router']
	}
};

const tsconfig = {
	extends: 'expo/tsconfig.base',
	compilerOptions: {
		strict: true
	},
	include: ['**/*.ts', '**/*.tsx', '.expo/types/**/*.ts', 'expo-env.d.ts']
};

export const defaultAppContents = `import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = ['Home', 'Explore', 'Profile'] as const;

export default function HomeScreen() {
  const [count, setCount] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Home');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>MY APP</Text>
        <Text style={styles.headerTitle}>{tab}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Daily streak</Text>
          <Text style={styles.heroValue}>{count}</Text>
          <Text style={styles.heroHint}>Tap + to keep your streak alive.</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.button} onPress={() => setCount((c) => Math.max(0, c - 1))}>
            <Text style={styles.buttonLabel}>−</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => setCount((c) => c + 1)}>
            <Text style={[styles.buttonLabel, styles.buttonPrimaryLabel]}>+</Text>
          </Pressable>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => setCount(0)}>
          <Text style={styles.secondaryLabel}>Reset streak</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((label) => {
          const active = tab === label;
          return (
            <Pressable
              key={label}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(label)}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#09090b'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '600',
    color: '#71717a'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fafafa'
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    gap: 8,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a'
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa'
  },
  heroValue: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '700',
    color: '#fafafa'
  },
  heroHint: {
    fontSize: 14,
    color: '#71717a'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181b'
  },
  buttonPrimary: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8'
  },
  buttonLabel: {
    color: '#fafafa',
    fontSize: 24,
    fontWeight: '600'
  },
  buttonPrimaryLabel: {
    color: '#ffffff'
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#111113'
  },
  secondaryLabel: {
    color: '#d4d4d8',
    fontSize: 15,
    fontWeight: '500'
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    backgroundColor: '#0f0f12',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 6
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14
  },
  tabActive: {
    backgroundColor: '#18181b'
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a'
  },
  tabLabelActive: {
    color: '#fafafa'
  }
});
`;

const layoutTsx = `import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
`;

const metroConfig = `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
`;

const babelConfig = `module.exports = function (api) {
	api.cache(true);
	return {
		presets: ['babel-preset-expo']
	};
};
`;

export function createExpoMount(appContents: string): FileSystemTree {
	return {
		'package.json': { file: { contents: JSON.stringify(packageJson, null, 2) } },
		'expo-dev.cjs': { file: { contents: expoDevScript } },
		'wc-preload.cjs': { file: { contents: expoWcPreload } },
		'wc-preload.js': { file: { contents: expoWcPreload } },
		'babel.config.js': { file: { contents: babelConfig } },
		'metro.config.js': { file: { contents: metroConfig } },
		'.npmrc': { file: { contents: npmrc } },
		'app.json': { file: { contents: JSON.stringify(appJson, null, 2) } },
		'tsconfig.json': { file: { contents: JSON.stringify(tsconfig, null, 2) } },
		app: {
			directory: {
				'_layout.tsx': { file: { contents: layoutTsx } },
				'index.tsx': { file: { contents: appContents } }
			}
		}
	};
}

export const expoTemplate: ProjectTemplate = {
	id: 'expo',
	label: 'Expo',
	entryFile: 'app/index.tsx',
	snapshotVersion: 'expo-v9',
	defaultAppContents,
	createMount: createExpoMount
};
