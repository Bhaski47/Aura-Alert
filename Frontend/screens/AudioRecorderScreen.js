import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet,Alert,Text,Button,Pressable,Animated,Easing,ScrollView,SafeAreaView,View,Platform,TextInput, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

const AudioRecorderScreen = () => {
  const [recording, setRecording] = React.useState();
  const [recordings, setRecordings] = React.useState([]);
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [buttonScale] = React.useState(new Animated.Value(1));
  const [currentlyPlayingIndex, setCurrentlyPlayingIndex] = React.useState(null);
  const [text, setText] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
        );
        setRecording(recording);

        Animated.spring(buttonScale, {
          toValue: 0.9,
          useNativeDriver: true,
        }).start();
      }
    } catch (err) {}
  }

  async function stopRecording() {
    setRecording(undefined);

    await recording.stopAndUnloadAsync();
    const { sound, status } = await recording.createNewLoadedSoundAsync();
    const { color, text } = await sendAudioToServer(recording.getURI());

    const newRecording = {
      sound,
      duration: getDurationFormatted(status.durationMillis),
      file: recording.getURI(),
      color,
      text,
      isPlaying: false,
    };

    setRecordings((prevRecordings) => [...prevRecordings, newRecording]);
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }

  const togglePlayRecording = async (recordingLine, index) => {
    if (currentlyPlayingIndex !== null && currentlyPlayingIndex !== index) {
      await recordings[currentlyPlayingIndex].sound.stopAsync();
      setCurrentlyPlayingIndex(null);
    }

    if (currentlyPlayingIndex === index) {
      await recordingLine.sound.stopAsync();
      setCurrentlyPlayingIndex(null);
    } else {
      setCurrentlyPlayingIndex(index);
      await recordingLine.sound.replayAsync();
      recordingLine.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setCurrentlyPlayingIndex(null);
        }
      });
    }
  };

  function getDurationFormatted(milliseconds) {
    const minutes = milliseconds / 1000 / 60;
    const seconds = Math.round((minutes - Math.floor(minutes)) * 60);
    return seconds < 10
      ? `${Math.floor(minutes)}:0${seconds}`
      : `${Math.floor(minutes)}:${seconds}`;
  }

  function getRecordingLines() {
    return recordings.map((recordingLine, index) => (
      <Animated.View
        key={index}
        style={[
          styles.recordingCard,
          {
            opacity: fadeAnim,
            backgroundColor: recordingLine.color || "#fff",
            borderColor:
              recordingLine.color === "#FFE6E6"
                ? "#FF4D4D"
                : recordingLine.color === "#E6FFE6"
                ? "#66CC66"
                : "#fff",
            borderWidth: 2,
          },
        ]}
      >
        <View style={{ width: "80%" }}>
          <Text style={styles.recordingText}>
            Recording #{index + 1} | {recordingLine.duration}
          </Text>
          <Text style={{ fontSize: 12, color: "#696969" }}>
            {recordingLine.text}
          </Text>
        </View>
        <Pressable
          style={[
            styles.playButton,
            {
              backgroundColor:
                recordingLine.color === "#FFE6E6" // Light Red
                  ? "#FF4D4D" // Slightly darker red background
                  : recordingLine.color === "#E6FFE6" // Light Green
                  ? "#66CC66" // Darker green background
                  : "#fff", // Default background
              borderColor:
                recordingLine.color === "#FFE6E6" // Light Red
                  ? "#FF4D4D" // Dark Red border
                  : recordingLine.color === "#E6FFE6" // Light Green
                  ? "#66CC66" // Dark Green border
                  : "#fff", // Default border
            },
          ]}
          onPress={() => togglePlayRecording(recordingLine, index)}
        >
          <Text style={styles.playText}>
            {currentlyPlayingIndex === index ? "Playing" : "Play"}
          </Text>
        </Pressable>
      </Animated.View>
    ));
  }

  const sendAudioToServer = async (uri) => {
    if(ipAddress === "") return;
    const formData = new FormData();
    formData.append("file", {
      uri,
      name: "recording.wav",
      type: "audio/wav",
    });
    const url = `http://${ipAddress}:5000/predict`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const result = await response.json();
      if (result.prediction === "Dangerous sound detected. Alerting Police") {
        Alert.alert("Alert", JSON.stringify(result.prediction));
        return {
          color: "#FFE6E6",
          text: "Dangerous sound detected. Alerting Police",
        };
      } else {
        Alert.alert("Alert", JSON.stringify(result.prediction));
        return { color: "#E6FFE6", text: "No dangerous sound detected" };
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      Alert.alert(
        "Upload failed",
        "An error occurred while uploading the file."
      );
    }
  };
  function clearRecordings() {
    setRecordings([]);
    fadeAnim.setValue(0);
  }

  const sheetRef = useRef();

  const snapPoints = useMemo(() => ["40%"], []);

  // callbacks
  const handleSheetChange = useCallback((index) => {
    setIsSheetOpen(index !== -1); // Update isSheetOpen state based on index
  }, []);

  const handleSnapPress = useCallback((index) => {
    sheetRef.current?.snapToIndex(index);
  }, []);

  const handleClosePress = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            style={[
              styles.recordButton,
              recording ? styles.stopButton : styles.startButton,
            ]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Text style={styles.buttonText}>
              {recording ? "Stop Recording" : "Start Recording"}
            </Text>
          </Pressable>
        </Animated.View>
        {getRecordingLines()}
      </ScrollView>
      {recordings.length > 0 ? (
  <View style={{ backgroundColor: "#f5f5f5" }}>
    <Pressable
      style={[
        styles.clearButton,
        { marginBottom: Platform.OS === "android" ? 20 : 0 },
      ]}
      onPress={clearRecordings}
    >
      <Text style={styles.buttonText}>Clear Recordings</Text>
    </Pressable>
  </View>
) : (
  recordings.length === 0 && !isSheetOpen && (
    <TouchableOpacity
      onPress={() => handleSnapPress(0)}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        borderRadius: 10,
        marginBottom: Platform.OS === "android" ? 10 : 0,
        backgroundColor: "#6f9cde",
        paddingVertical: 10,
        paddingHorizontal: 20,
        width: "50%",
        alignSelf: "center",
      }}
    >
      <Text style={{ textAlign: "center", color: "white" }}>Server IP</Text>
    </TouchableOpacity>
  )
)}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
      >
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          <View style={{padding:'5%', gap:10}}>
            <Text>Server IP Address</Text>
            <View style={{flexDirection:'row',gap:10}}>
              <TextInput
                numberOfLines={1}
                maxLength={15}
                onChangeText={(text) => setText(text)}
                value={text}
                style={[styles.textInput,{padding : Platform.OS === "ios" ? 10 : 5}]}
                placeholder="Enter IP Address"
                placeholderTextColor="gray"
              />
              <TouchableOpacity style={{backgroundColor:'#4CAF50',borderRadius:10,paddingVertical:5,paddingHorizontal:25,justifyContent:'center'}} onPress={()=>{
                setIpAddress(text)
                handleClosePress()
                }}>
                <Text style={{color:'white'}}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={{alignSelf:'center',backgroundColor:'#FF4D4D',borderRadius:10,paddingVertical:10,paddingHorizontal:25}} onPress={handleClosePress} >
            <Text style={{color:'white'}}>Close</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  recordButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#E53935",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  recordingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  recordingText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  playButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  playText: {
    color: "#fff",
    fontWeight: "bold",
  },
  clearButton: {
    backgroundColor: "#FFB74D",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: "50%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  textInput: {
    borderWidth: 1,
    width: "70%",
    // borderRadius: "10%",
    borderColor: '#ccc',
  },
  contentContainer:{
    flex:1,
    backgroundColor:'white'
  }
});

export default AudioRecorderScreen;
