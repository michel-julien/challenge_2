import multer from "multer";

const upload = multer({ dest: "src/uploads/" });

export default upload;
