import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Video from 'react-native-video';

const { height, width } = Dimensions.get('window');

export default function PlayerScreen({ route }) {
  const { source } = route.params;
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  if (source.type === 'iframe') {
    return (
      <View style={styles.container}>
        <WebView 
          source={{ uri: source.url }} 
          allowsFullscreenVideo 
          javaScriptEnabled={true} 
          domStorageEnabled={true} 
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
        onLoad={(data) => setDuration(data.duration)}
        onProgress={(data) => setCurrentTime(data.currentTime)}
        paused={paused}
        style={styles.video}
        controls={true}
        fullscreenOrientation="landscape"
      />

      <View style={styles.overlay}>
        <TouchableOpacity onPress={() => setPaused(!paused)}>
          <Text style={{ color: '#fff' }}>{paused ? 'PLAY' : 'PAUSE'}</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff' }}>
          {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60)} / {Math.floor(duration / 60)}:{Math.floor(duration % 60)}
        </Text>
        <Text style={{ color: '#E50914', fontWeight: 'bold' }}>
          {source.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: width, height: height },
  overlay: { 
    position: 'absolute', 
    bottom: 50, 
    width: '100%', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    paddingVertical: 10 
  }
});
