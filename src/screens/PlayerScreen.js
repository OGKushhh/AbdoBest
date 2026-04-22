import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { WebView } from 'react-native-webview';

const { height, width } = Dimensions.get('window');

export default function PlayerScreen({ route }) {
  const { source } = route.params;
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // If it's not a direct video URL, use WebView
  if (!source.url.includes('.mp4') && !source.url.includes('.m3u8')) {
    return (
      <View style={styles.container}>
        <WebView
          source={{ uri: source.url }}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={styles.webview}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: source.url }}
        ref={videoRef}
        resizeMode="contain"
        shouldPlay={!paused}
        useNativeControls
        onLoad={(status) => setDuration(status.durationMillis / 1000)}
        onProgress={(status) => setCurrentTime(status.positionMillis / 1000)}
        style={styles.video}
      />
      <View style={styles.overlay}>
        <TouchableOpacity onPress={() => setPaused(!paused)}>
          <Text style={styles.buttonText}>{paused ? 'PLAY' : 'PAUSE'}</Text>
        </TouchableOpacity>
        <Text style={styles.timeText}>
          {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60)} / {Math.floor(duration / 60)}:{Math.floor(duration % 60)}
        </Text>
        <Text style={styles.labelText}>{source.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { width, height },
  webview: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontSize: 16 },
  timeText: { color: '#fff', marginTop: 5 },
  labelText: { color: '#E50914', fontWeight: 'bold', marginTop: 5 },
});