import MappingTool from "./Asset/MappingTool";

// "ค้นหา mapping_id": the same page in the menu of every Role (see Sidebar* and App* of each Role)
const MappingToolPage = () => (
  <div style={{ backgroundColor: "#fff" }} className="flex-1 min-h-0 flex flex-col overflow-auto relative z-10">
    <MappingTool />
  </div>
);

export default MappingToolPage;
