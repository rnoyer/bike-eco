import { StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>COUCOU</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#666666",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
  },
});
