import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import ProfilePicture from './profile-picture.js';

createApp({
  components: {
    ProfilePicture
  },
  data() {
    return {
      activeTab: "all",
      fabMenuOpen: false,
      showClassList: false,
      mitClasses: ["6.100L", "6.4500", "2.678", "18.06", "21L.003"],
      joinedClassChats: [],
      kerberosList: ["alice", "bob", "carla", "daniel"],
      showKerberosSelect: false,
      individualChats: [],
      groupNameInput: "",
      selectedKerbs: [],
      showGroupForm: false,
      mitKerbs: ["jdoe", "alum123", "khidalgo", "zhuang", "cfisher"],
      groupChatObjects: [],
      renamedGroups: [],
      renameInputs: {},
      selectedChannel: null,
      myMessage: "",
      sending: false,
      editingMessage: null,
      editContent: "",
      viewingProfile: false,
      profileTab: "participants",
      editingProfile: false,
      profileForm: {
        name: "",
        pronouns: "",
        profile_picture: "",
        description: "",
        classes: ""
      },

    };
  },

  computed: {
    allChats() {
      const all = [];

      this.groupChatObjects.forEach(group => {
        const channel = group.value.object.channel;
        const name = this.getRenamedGroupName(channel) || group.value.object.name;
        all.push({ type: "group", name, channel });
      });

      this.joinedClassChats.forEach(className => {
        const channel = `class:mit:${className}`;
        all.push({ type: "class", name: className, channel });
      });

      this.individualChats.forEach(chat => {
        const displayName = chat.replace("dm:", "").replace(this.$graffitiSession.value.actor, "").replace(":", "");
        all.push({ type: "individual", name: displayName, channel: chat });
      });

      const seen = new Set();
      return all.filter(c => {
        if (seen.has(c.channel)) return false;
        seen.add(c.channel);
        return true;
      });
    }
  },

  methods: {
    toggleFabMenu() {
      this.fabMenuOpen = !this.fabMenuOpen;
    },

    createIndividualChat() {
      this.fabMenuOpen = false;
      this.showKerberosSelect = true;
    },

    joinClassChat() {
      this.fabMenuOpen = false;
      this.showClassList = true;
    },

    async joinClassChannel(className) {
      const classChannel = `class:mit:${className}`;
      this.joinedClassChats.push(className);
      await this.$graffiti.put({
        value: { activity: "Join", object: "Class Chat", target: classChannel },
        channels: [classChannel],
      }, this.$graffitiSession.value);
      this.showClassList = false;
    },

    async startIndividualChat(kerb) {
      const chatId = `dm:${[kerb, this.$graffitiSession.value.actor].sort().join(":")}`;
      this.individualChats.push(chatId);
      await this.$graffiti.put({
        value: {
          activity: "Create",
          object: { type: "DM", between: [kerb, this.$graffitiSession.value.actor], channel: chatId }
        },
        channels: ["mitchats"]
      }, this.$graffitiSession.value);
      this.showKerberosSelect = false;
    },

    async submitGroupChat() {
      if (!this.groupNameInput || this.selectedKerbs.length === 0) return;
      const actor = this.$graffitiSession.value.actor;
      const members = [...new Set([...this.selectedKerbs, actor])];
      const newChannel = `group:${crypto.randomUUID()}`;
      await this.$graffiti.put({
        value: {
          activity: "Create",
          object: { type: "Group Chat", name: this.groupNameInput, channel: newChannel, members }
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);
      this.groupNameInput = "";
      this.selectedKerbs = [];
      this.showGroupForm = false;
    },

    enterChat(channel) {
      this.selectedChannel = channel;
    },

    leaveChat() {
      this.selectedChannel = null;
    },

    async sendMessage(session) {
      if (!this.myMessage || !this.selectedChannel) return;
      this.sending = true;
      await this.$graffiti.put({
        value: { content: this.myMessage, published: Date.now() },
        channels: [this.selectedChannel],
      }, session);
      this.myMessage = "";
      this.sending = false;
      await this.$nextTick();
      this.$refs.messageInput?.focus();
    },

    startEdit(message) {
      this.editingMessage = message;
      this.editContent = message.value.content;
    },

    cancelEdit() {
      this.editingMessage = null;
      this.editContent = "";
    },

    async saveEdit(message) {
      await this.$graffiti.patch({
        value: [{ op: "replace", path: "/content", value: this.editContent }]
      }, message, this.$graffitiSession.value);
      this.editingMessage = null;
      this.editContent = "";
    },

    async deleteMessage(message) {
      await this.$graffiti.delete(message, this.$graffitiSession.value);
    },

    async renameGroup(groupChannel, newName) {
      if (!newName.trim()) return;
      await this.$graffiti.put({
        value: { name: newName, describes: groupChannel },
        channels: ["designftw"]
      }, this.$graffitiSession.value);
      this.renameInputs[groupChannel] = "";
    },

    getRenamedGroupName(channel) {
      const renameObj = this.renamedGroups.find(obj => obj.value.describes === channel);
      return renameObj ? renameObj.value.name : null;
    },

    getChatDisplayName(channel) {
      if (!channel) return "";
      const renamed = this.getRenamedGroupName(channel);
      if (renamed) return renamed;
      const group = this.groupChatObjects.find(g => g.value.object.channel === channel);
      if (group) return group.value.object.name;
      if (channel.startsWith("class:mit:")) return channel.replace("class:mit:", "");
      if (channel.startsWith("dm:")) return channel.replace("dm:", "").replace(this.$graffitiSession.value.actor, "").replace(":", "");
      return channel;
    },

    updateGroupChatObjects(objects) {
      const myActor = this.$graffitiSession.value.actor;
      this.groupChatObjects = objects.filter(obj =>
        obj.value.activity === "Create" &&
        Array.isArray(obj.value.object.members) &&
        obj.value.object.members.includes(myActor)
      );
    },

    updateRenamedGroups(objects) {
      this.renamedGroups = objects;
    },

    updateJoinedClassChats(objects) {
      const myActor = this.$graffitiSession.value.actor;
      const myJoins = objects.filter(obj => obj.actor === myActor);
      const uniqueClasses = new Set();
      myJoins.forEach(obj => {
        const className = obj.value.target.replace("class:mit:", "");
        uniqueClasses.add(className);
      });
      this.joinedClassChats = Array.from(uniqueClasses);
    },

    updateIndividualChats(objects) {
      const me = this.$graffitiSession.value.actor;
      const seen = new Set();
      this.individualChats = objects
        .filter(obj => obj.value.object.between.includes(me))
        .map(obj => obj.value.object.channel)
        .filter(channel => {
          if (seen.has(channel)) return false;
          seen.add(channel);
          return true;
        });
    },

    viewProfile() {
      this.viewingProfile = true;
      this.profileTab = 'participants';
    },

    exitProfile() {
      this.viewingProfile = false;
    },

    getChatParticipants(channel) {
      if (channel.startsWith("group:")) {
        const group = this.groupChatObjects.find(g => g.value.object.channel === channel);
        return group ? group.value.object.members : [];
      }
      if (channel.startsWith("class:mit:")) return this.mitKerbs;
      if (channel.startsWith("dm:")) return channel.replace("dm:", "").split(":");
      return [];
    },

    startEditProfile() {
      this.editingProfile = true;
    },

    async handleLogin() {
      const kerb = prompt("Enter your Kerberos ID (ex: ricardoj)");
      if (!kerb) return;
    
      await this.$graffiti.login({ actor: kerb });
      localStorage.setItem('kerberos', kerb);
    
      console.log("✅ Logged in as", this.$graffitiSession.value.actor);
    
      this.editingProfile = false;
    
      // 🧼 RESET FIRST to avoid stale values
      this.resetProfileForm();       
    
      // 🔄 THEN attempt to load saved profile
      this.loadProfileFromLocalStorage();
    },

    

    async saveProfile() {
      if (!this.$graffitiSession.value) return;
    
      const profile = {
        name: this.profileForm.name,
        pronouns: this.profileForm.pronouns,
        profile_picture: this.profileForm.profile_picture,
        description: this.profileForm.description,
        classes: this.profileForm.classes.split(',').map(c => c.trim()),
        describes: this.$graffitiSession.value.actor,
        published: Date.now()
      };
    
      // Save in Graffiti
      await this.$graffiti.put({
        value: profile,
        channels: [this.$graffitiSession.value.actor]
      }, this.$graffitiSession.value);
    
      // ALSO save in localStorage for backup
      localStorage.setItem(`profile-${this.$graffitiSession.value.actor}`, JSON.stringify(profile));

    
      console.log("✅ Profile saved!");
      this.editingProfile = false;
    },

    handleProfilePictureUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
    
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profileForm.profile_picture = e.target.result; // base64 string
      };
      reader.readAsDataURL(file);
    },

    loadProfileFromLocalStorage() {
      if (!this.$graffitiSession.value) return;
    
      const savedProfile = localStorage.getItem(`profile-${this.$graffitiSession.value.actor}`);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        this.profileForm = {
          name: parsed.name || "",
          pronouns: parsed.pronouns || "",
          profile_picture: parsed.profile_picture || "",
          description: parsed.description || "",
          classes: parsed.classes ? parsed.classes.join(", ") : ""
        };
        console.log("✅ Profile loaded from localStorage immediately after login!");
      } else {
        // 🛠 Reset to blank if no saved profile exists
        this.resetProfileForm();
        console.log("ℹ️ No profile found in localStorage. Resetting to blank.");
      }
    },

    updateProfile(objects) {
      if (objects.length === 0) return;
    
      const latest = objects.sort((a, b) => b.value.published - a.value.published)[0].value;
    
      this.profileForm = {
        name: latest.name || "",
        pronouns: latest.pronouns || "",
        profile_picture: latest.profile_picture || "",
        description: latest.description || "",
        classes: latest.classes ? latest.classes.join(", ") : ""
      };
    
      console.log("✅ Profile auto-loaded from graffiti-discover!");
    },
    resetProfileForm() {
      this.profileForm = {
        name: "",
        pronouns: "",
        profile_picture: "",
        description: "",
        classes: ""
      };
    },
    getProfilePicture(chat) {
      const otherUser = chat.replace("dm:", "").replace(this.$graffitiSession.value.actor, "").replace(":", "");
      const local = localStorage.getItem(`profile-${otherUser}`);
    
      if (local) {
        try {
          const parsed = JSON.parse(local);
          const pic = parsed.profile_picture;
          if (pic) {
         
            return pic.startsWith("data:image") ? pic : `data:image/jpeg;base64,${pic}`;
          }
        } catch (e) {
          console.warn("⚠️ Couldn't parse profile:", local);
        }
      }
    
      return null;
    }
    
    ,
    getOtherUser(chat) {
      if (!chat || !this.$graffitiSession.value?.actor) return "Unknown";

      const currentUser = this.$graffitiSession.value.actor;
      const parts = chat.replace("dm:", "").split(":");

      // Show the user that is not me
      const otherUser = parts.find(p => p !== currentUser);
      console.log("👤 Other user resolved as:", otherUser); // Add this to verify
      return otherUser || "Unknown";
    }, 
      // In index.js
      getChatProfilePicture(channel) {
        if (channel.startsWith("dm:")) {
          return this.getProfilePicture(channel); // base64 or null
        }
        // All others return null to trigger fallback
        return null;
      },
      getChatFallback(channel) {
        if (channel.startsWith("group:")) return "👥";
        if (channel.startsWith("class:mit:")) return "🎓";
        return "👤";
      }
      

    



    
    
  
    
  },
  mounted() {
    const kerb = localStorage.getItem('kerberos');
    if (kerb) {
      console.log("✅ Found saved kerberos:", kerb);
      this.$graffiti.login({ actor: kerb }).then(() => {
        this.editingProfile = false;
  
        // 🔄 Reset to prevent leftover profile
        this.resetProfileForm();
  
        this.loadProfileFromLocalStorage();
      });
    }
  },

  
  
})
.use(GraffitiPlugin, { graffiti: new GraffitiLocal() })
.mount("#app");







