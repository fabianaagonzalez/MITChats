
import { defineComponent, h } from "vue";


export default defineComponent({
    name: "ProfilePicture",
    props: {
      src: {
        type: String,
        default: ""
      },
      size: {
        type: String,
        default: "32px"
      },
      fallback: {
        type: String,
        default: "👤"
      }
    },
    setup(props) {
      const style = {
        width: props.size,
        height: props.size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#ddd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: "16px"
      };
  
      const isValidImageSrc = (src) =>
        typeof src === "string" && src.startsWith("data:image");
  
      return () =>
        h(
          "div",
          { class: "chat-profile-picture", style },
          isValidImageSrc(props.src)
            ? h("img", {
                src: props.src,
                alt: "Profile Picture",
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }
              })
            : h("div", {}, props.fallback)
        );
    }
  });
  




  
  