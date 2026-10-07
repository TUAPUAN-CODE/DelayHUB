const Buttom = ({ title }) => {
  return (
    <footer
      style={{
        backgroundColor: "#fff",
        color: "#6B7489",
        borderRadius: 14,
        border: "1px solid #E3E8F2",
        padding: "8px 15px",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(16,24,40,.05)",
      }}
    >
      <h6 style={{ textAlign: "center", margin: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 400 }}>{title}</h6>
    </footer>
  );
};

export default Buttom;
