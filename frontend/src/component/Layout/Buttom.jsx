const Buttom = ({ title }) => {
  return (
    <footer
      className="glass"
      style={{
        color: "#6B7489",
        borderRadius: 14,
        padding: "8px 15px",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h6 style={{ textAlign: "center", margin: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 400 }}>{title}</h6>
    </footer>
  );
};

export default Buttom;
