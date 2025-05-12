import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import ProfilePicture from './profile-picture.js';
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";



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
        classes: "",
        preferences: {
          study_time: "",       
          meeting_style: "",    
          location: "",        
          group_size: ""        
        },
      },
      joinedClassParticipants: {}, 
      notificationMessage: "",
      notificationVisible: false


    

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
    
      // 🌟 Smooth spinning logic
      const fabButton = document.querySelector(".fab-main");
      if (fabButton) {
        if (this.fabMenuOpen) {
          fabButton.classList.remove("spin-back");
          fabButton.classList.add("spinning");
        } else {
          fabButton.classList.remove("spinning");
          fabButton.classList.add("spin-back");
        }
      }
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
      const messageElement = document.querySelector(`[data-message-id="${message.url}"]`);
    
      if (messageElement) {
     
        messageElement.classList.add("imploding");
    
     
        await new Promise(resolve => setTimeout(resolve, 400)); 
      }
    
   
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



    // updateJoinedClassChats(objects) {
    //   const byClass = {}; 
    
    //   objects.forEach(obj => {
    //     const classChannel = obj.value.target;
    //     if (!byClass[classChannel]) byClass[classChannel] = [];
    //     byClass[classChannel].push(obj.actor);
    //   });
    
      
    //   this.joinedClassParticipants = byClass;
    
   
    //   const myActor = this.$graffitiSession.value.actor;
    //   const myJoins = objects.filter(obj => obj.actor === myActor);
    //   const uniqueClasses = new Set();
    //   myJoins.forEach(obj => {
    //     const className = obj.value.target.replace("class:mit:", "");
    //     uniqueClasses.add(className);
    //   });
    //   this.joinedClassChats = Array.from(uniqueClasses);
    // },

    updateJoinedClassChats(objects) {
      const byClass = {}; 
    
      objects.forEach(obj => {
        const classChannel = obj.value.target;
        if (!byClass[classChannel]) byClass[classChannel] = [];
        if (!byClass[classChannel].includes(obj.actor)) {
          byClass[classChannel].push(obj.actor);
        }
      });
    
      this.joinedClassParticipants = { ...byClass }; // This triggers Vue reactivity
    
      // Update the local list as well
      const myActor = this.$graffitiSession.value.actor;
      const myJoins = objects.filter(obj => obj.actor === myActor);
      const uniqueClasses = new Set();
      myJoins.forEach(obj => {
        const className = obj.value.target.replace("class:mit:", "");
        uniqueClasses.add(className);
      });
    
      // 🔄 Update the list to trigger reactivity
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
      this.loadPreferencesForChat(this.selectedChannel);
    },
    

    exitProfile() {
      this.viewingProfile = false;
    },

    
    getChatParticipants(channel) {
      if (!channel) {
        
        return [];
      }
    
      if (channel.startsWith("group:")) {
        const group = this.groupChatObjects.find(g => g.value.object.channel === channel);
        return group ? group.value.object.members : [];
      }
      if (channel.startsWith("class:mit:")) {
        return this.joinedClassParticipants[channel] || [];
      }
      if (channel.startsWith("dm:")) {
        return channel.replace("dm:", "").split(":");
      }
      return [];
    },
    

    startEditProfile() {
      this.editingProfile = true;
    },



    async handleLogin() {
      let kerb = this.profileForm.name;
      
      if (!kerb) {
        // If there's no Kerberos ID in the form, ask for it
        kerb = prompt("Enter your Kerberos ID (ex: ricardoj)");
        if (!kerb) return;
        localStorage.setItem('kerberos', kerb);
        this.profileForm.name = kerb;
      }
      
      console.log("🔓 Logging in as:", kerb);
    
      await this.$graffiti.login({ actor: kerb });
      
   
      this.selectedChannel = null;
      this.viewingProfile  = false;
      this.editingProfile  = false;
      this.activeTab       = 'all';
      this.resetProfileForm();
      
  
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
        preferences: this.profileForm.preferences,
        published: Date.now(),
        generator: "https://username.github.io/your-app/",
      };
    

      await this.$graffiti.put({
        value: profile,
        channels: [this.$graffitiSession.value.actor,"designftw-2025-studio2"]
      }, this.$graffitiSession.value);
    
  
      localStorage.setItem(`profile-${this.$graffitiSession.value.actor}`, JSON.stringify(profile));

    
      console.log("Profile saved!");
      this.editingProfile = false;
    },

    handleProfilePictureUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
    
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profileForm.profile_picture = e.target.result; 
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
          classes: parsed.classes ? parsed.classes.join(", ") : "",
          preferences: parsed.preferences || {
            study_time: "", meeting_style: "", location: "", group_size: ""
          }
          
        };
        console.log(" Profile loaded from localStorage immediately after login!");
      } else {
   
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
        classes: latest.classes ? latest.classes.join(", ") : "",
        preferences: latest.preferences || {
          study_time: "", meeting_style: "", location: "", group_size: ""
        }        
        
      };
    
      console.log("Profile auto-loaded from graffiti-discover!");
    },

    resetProfileForm() {
      this.profileForm = {
        name: "",
        pronouns: "",
        profile_picture: "",
        description: "",
        classes: "",
        preferences: {
          study_time: "",
          meeting_style: "",
          location: "",
          group_size: ""
        }
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

   
      const otherUser = parts.find(p => p !== currentUser);
      console.log("👤 Other user resolved as:", otherUser); 
      return otherUser || "Unknown";
    }, 
     
      getChatProfilePicture(channel) {
        if (channel.startsWith("dm:")) {
          return this.getProfilePicture(channel); 
        }
      
        return null;
      },
      getChatFallback(channel) {
        if (channel.startsWith("group:")) return "👥";
        if (channel.startsWith("class:mit:")) return "🎓";
        return "👤";
      },

      

      async savePreferencesForChat() {
        if (!this.selectedChannel || !this.$graffitiSession.value) return;
      
        const preferenceObject = {
          describes: this.selectedChannel,
          preferences: this.profileForm.preferences,
          published: Date.now()
        };
      
        await this.$graffiti.put({
          value: preferenceObject,
          channels: [this.selectedChannel]
        }, this.$graffitiSession.value);
      
        localStorage.setItem(`global-preferences-${this.$graffitiSession.value.actor}`, JSON.stringify(this.profileForm.preferences));
      
        console.log("Preferences saved for", this.selectedChannel);
      
     
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
          document.body.removeChild(existingToast);
        }
      
    
        const toast = document.createElement('div');
        toast.className = "toast-notification";
        toast.innerText = "Preferences Saved!";
        document.body.appendChild(toast);
     
        setTimeout(() => {
          toast.classList.add('show');
        }, 50);
      
   
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => {
            if (document.body.contains(toast)) {
              document.body.removeChild(toast);
            }
          }, 300);
        }, 2000);
      },
      
      loadPreferencesForChat(channel) {
        const local = localStorage.getItem(`prefs-${channel}-${this.$graffitiSession.value.actor}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            this.profileForm.preferences = parsed.preferences;
          } catch (e) {
            console.warn("⚠️ Couldn't parse chat preferences:", local);
          }
        } else {
          this.profileForm.preferences = {
            study_time: "",
            meeting_style: "",
            location: "",
            group_size: ""
          };
        }
      },
      get filteredParticipants() {
        if (!this.participantSearch) return this.getChatParticipants(this.selectedChannel);
        return this.getChatParticipants(this.selectedChannel).filter(participant =>
          participant.toLowerCase().includes(this.participantSearch.toLowerCase())
        );
      },

  
      


      async startOrEnterChat(participant) {
        const chatId = `dm:${[participant, this.$graffitiSession.value.actor].sort().join(":")}`;
      
        if (!this.individualChats.includes(chatId)) {
          // If the chat doesn't exist, create it
          this.individualChats.push(chatId);
      
          await this.$graffiti.put({
            value: {
              activity: "Create",
              object: { 
                type: "DM", 
                between: [participant, this.$graffitiSession.value.actor], 
                channel: chatId 
              }
            },
            channels: ["mitchats"]
          }, this.$graffitiSession.value);
      
          console.log(`Created new DM with ${participant}`);
        } else {
          console.log(`Entering existing DM with ${participant}`);
        }
    
        this.enterChat(chatId);
      },

      async openDirectMessage(participant) {
      
        const chatId = `dm:${[participant, this.$graffitiSession.value.actor].sort().join(":")}`;
      
       
        if (!this.individualChats.includes(chatId)) {
          this.individualChats.push(chatId);
          await this.$graffiti.put({
            value: {
              activity: "Create",
              object: { type: "DM", between: [participant, this.$graffitiSession.value.actor], channel: chatId }
            },
            channels: ["mitchats"]
          }, this.$graffitiSession.value);
        }
      
      
        this.selectedChannel = chatId;
      
      
        this.viewingProfile = false;
      },


      async logout() {
        await this.$graffiti.logout(this.$graffitiSession.value);
        this.selectedChannel = null;
        this.viewingProfile = false;
        this.editingProfile = false;
        this.activeTab = 'all';
        this.resetProfileForm();

        const welcomeBox = document.querySelector(".welcome-box");
        if (welcomeBox) {
          welcomeBox.style.animation = "none"; 
          setTimeout(() => {
            welcomeBox.style.animation = ""; 
          }, 10);
        }
      },

      async fetchNewMessages() {
        const updatedObjects = await this.$graffiti.discover({
          channels: [this.selectedChannel],
          schema: {
            properties: {
              value: {
                required: ['content', 'published'],
                properties: {
                  content: { type: 'string' },
                  published: { type: 'number' }
                }
              }
            }
          }
        });
    
        // Update the local list
        this.chatMessages = updatedObjects.sort((a, b) => a.value.published - b.value.published);
      }


      
      
      
      

      
      
      

    



    
    
  
    
  },


  mounted() {
    const kerb = localStorage.getItem('kerberos');
    if (kerb) {
      console.log("Found saved kerberos:", kerb);
    
      this.profileForm.name = kerb;
    }

    this.pollingInterval = setInterval(() => {
      if (this.selectedChannel) {
        this.fetchNewMessages();
      }
    }, 2000); // Poll every 2 seconds
  },

  beforeUnmount() {
    clearInterval(this.pollingInterval);
  },

  updated() {
    const container = document.querySelector('.chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },
  
  
  
})
.use(GraffitiPlugin, { 
    // graffiti: new GraffitiLocal() 
    graffiti: new GraffitiRemote(),

})
.mount("#app");







