<template>
    <div class="unauthorized-page">
        <!-- Animated background -->
        <div class="bg-mesh"></div>
        <div class="bg-particles">
            <span v-for="n in 20" :key="n" class="particle" :style="particleStyle(n)"></span>
        </div>

        <div class="page-inner">
            <!-- Brand -->
            <div class="brand">
                <div class="">
                    <q-img src="../../../public/icons/favicon-32x32.png" style="width: 24px; height: 24px;" />

                </div>
                <span class="brand-name">Agent<b>X</b></span>
            </div>

            <!-- Main card -->
            <div class="card">
                <!-- Illustration -->
                <div class="illustration">
                    <div class="illustration-ring ring-1"></div>
                    <div class="illustration-ring ring-2"></div>
                    <div class="illustration-core">
                        <q-icon name="smart_toy" size="42px" />
                    </div>
                    <div class="illustration-lock">
                        <q-icon name="lock" size="16px" />
                    </div>
                </div>

                <span class="eyebrow">Lỗi 401</span>
                <h1 class="title">Bạn chưa được cấp quyền truy cập</h1>
                <p class="subtitle">
                    Tài khoản của bạn không có quyền truy cập vào khu vực này của AgentX.
                    Vui lòng liên hệ quản trị viên hệ thống để được cấp quyền phù hợp.
                </p>

                <!-- Account info -->
                <transition name="fade-slide">
                    <div v-if="showUserInfo" class="account-panel">
                        <div class="account-row">
                            <div class="account-avatar">
                                <q-icon name="person" size="18px" />
                            </div>
                            <div class="account-detail">
                                <span class="account-name">{{ userInfo.name }}</span>
                                <span class="account-email">{{ userInfo.email }}</span>
                            </div>
                        </div>

                        <div v-if="requiredRoles.length > 0" class="roles-panel">
                            <div class="roles-label">
                                <q-icon name="verified_user" size="14px" />
                                Quyền yêu cầu
                            </div>
                            <div class="roles-list">
                                <span v-for="role in requiredRoles" :key="role" class="role-tag">
                                    {{ role }}
                                </span>
                            </div>
                        </div>
                    </div>
                </transition>

                <!-- Actions -->
                <div class="actions">
                    <button class="btn btn-ghost" @click="goBack">
                        <q-icon name="arrow_back" size="16px" />
                        Quay lại
                    </button>
                    <button class="btn btn-solid" @click="goDashboard">
                        <q-icon name="dashboard" size="16px" />
                        Về trang chủ
                    </button>
                    <button class="btn btn-danger" @click="logout">
                        <q-icon name="logout" size="16px" />
                        Đăng xuất
                    </button>
                </div>
            </div>

            <!-- Support -->
            <p class="support">
                Cho rằng đây là nhầm lẫn?
                <a href="mailto:it@hitc.vn">
                    <q-icon name="mail" size="14px" />
                    Liên hệ it@hitc.vn
                </a>
            </p>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { keycloakService } from 'src/services/keycloak.service'
import { ENV } from 'src/services/env.js'

const router = useRouter()

// User Information
const userInfo = computed(() => keycloakService.getUserInfo())
const allRoles = computed(() => keycloakService.getUserRoles())
const showUserInfo = computed(() => keycloakService.isAuthenticated())
const requiredRoles = computed(() => ENV.REQUIRED_ROLES)

// Decorative particle positions/timing
const particleStyle = (n) => {
    const left = (n * 37) % 100
    const delay = (n % 10) * 0.8
    const duration = 8 + (n % 6)
    const size = 2 + (n % 3)
    return {
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: `${size}px`,
        height: `${size}px`
    }
}

// Actions
const goBack = () => {
    if (window.history.length > 1) {
        router.back()
    } else {
        router.push({ name: 'dashboard' })
    }
}

const goDashboard = () => {
    router.push({ name: 'dashboard' })
}

const logout = async () => {
    await keycloakService.logout()
}

// Log access attempt
onMounted(() => {
    console.error('401 Unauthorized Access Attempt', {
        timestamp: new Date().toISOString(),
        user: userInfo.value.username,
        userRoles: allRoles.value,
        requiredRoles: requiredRoles.value,
        routeAttempted: router.currentRoute.value.fullPath,
        referrer: document.referrer
    })
})
</script>

<style scoped lang="scss">
@keyframes drift {
    0% {
        transform: translateY(0) translateX(0);
        opacity: 0;
    }

    10% {
        opacity: 0.7;
    }

    90% {
        opacity: 0.5;
    }

    100% {
        transform: translateY(-110vh) translateX(20px);
        opacity: 0;
    }
}

@keyframes meshShift {

    0%,
    100% {
        background-position: 0% 0%, 100% 100%;
    }

    50% {
        background-position: 100% 50%, 0% 50%;
    }
}

@keyframes riseIn {
    from {
        opacity: 0;
        transform: translateY(28px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes spinSlow {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

@keyframes spinSlowReverse {
    from {
        transform: rotate(360deg);
    }

    to {
        transform: rotate(0deg);
    }
}

@keyframes corePulse {

    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5);
    }

    50% {
        box-shadow: 0 0 0 16px rgba(99, 102, 241, 0);
    }
}

@keyframes lockBounce {

    0%,
    100% {
        transform: translateY(0) scale(1);
    }

    50% {
        transform: translateY(-3px) scale(1.06);
    }
}

.unauthorized-page {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 24px;
    background: #0a0a12;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    .bg-mesh {
        position: absolute;
        inset: -10%;
        background:
            radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.35), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(236, 72, 153, 0.3), transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.15), transparent 50%);
        background-size: 150% 150%, 150% 150%, 150% 150%;
        animation: meshShift 16s ease-in-out infinite;
        filter: blur(10px);
    }

    .bg-particles {
        position: absolute;
        inset: 0;
        pointer-events: none;

        .particle {
            position: absolute;
            bottom: -20px;
            border-radius: 50%;
            background: rgba(165, 180, 252, 0.6);
            animation: drift linear infinite;
        }
    }

    .page-inner {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 560px;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 28px;
        animation: riseIn 0.5s ease both;

        .brand-mark {
            width: 34px;
            height: 34px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            color: #fff;
        }

        .brand-name {
            font-size: 18px;
            font-weight: 600;
            color: #e4e4f4;
            letter-spacing: 0.3px;

            b {
                background: linear-gradient(135deg, #ffca28, #ff7043);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
            }
        }
    }

    .card {
        width: 100%;
        background: rgba(255, 255, 255, 0.035);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 44px 40px;
        text-align: center;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
        animation: riseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;

        .illustration {
            position: relative;
            width: 96px;
            height: 96px;
            margin: 0 auto 24px;

            .illustration-ring {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 1.5px dashed rgba(129, 140, 248, 0.4);
            }

            .ring-1 {
                animation: spinSlow 18s linear infinite;
            }

            .ring-2 {
                inset: 10px;
                border-color: rgba(244, 114, 182, 0.35);
                animation: spinSlowReverse 14s linear infinite;
            }

            .illustration-core {
                position: absolute;
                inset: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #4f46e5, #db2777);
                color: #fff;
                animation: corePulse 2.6s ease-out infinite;
            }

            .illustration-lock {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0a0a12;
                border: 2px solid #f59e0b;
                color: #f59e0b;
                animation: lockBounce 2s ease-in-out infinite;
            }
        }

        .eyebrow {
            display: inline-block;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: #f472b6;
            margin-bottom: 10px;
        }

        .title {
            font-size: 24px;
            font-weight: 700;
            color: #f5f5fa;
            margin: 0 0 12px 0;
            line-height: 1.35;
        }

        .subtitle {
            font-size: 14.5px;
            color: #a5a5c0;
            line-height: 1.7;
            margin: 0 auto;
            max-width: 420px;
        }

        .account-panel {
            margin-top: 24px;
            text-align: left;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 14px;
            padding: 18px 20px;

            .account-row {
                display: flex;
                align-items: center;
                gap: 12px;

                .account-avatar {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #6366f1, #ec4899);
                    color: #fff;
                }

                .account-detail {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;

                    .account-name {
                        font-size: 14px;
                        font-weight: 600;
                        color: #f0f0f8;
                    }

                    .account-email {
                        font-size: 12.5px;
                        color: #8f8fb0;
                        font-family: 'JetBrains Mono', Menlo, monospace;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                }
            }

            .roles-panel {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.07);

                .roles-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11.5px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #a5b4fc;
                    margin-bottom: 10px;
                }

                .roles-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;

                    .role-tag {
                        font-size: 12px;
                        font-weight: 500;
                        padding: 5px 12px;
                        border-radius: 20px;
                        color: #e9d5ff;
                        background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(236, 72, 153, 0.25));
                        border: 1px solid rgba(165, 180, 252, 0.3);
                    }
                }
            }
        }

        .actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 30px;

            .btn {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 10px 18px;
                font-size: 13.5px;
                font-weight: 600;
                border-radius: 10px;
                border: 1px solid transparent;
                cursor: pointer;
                transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

                &:hover {
                    transform: translateY(-2px);
                }

                &:active {
                    transform: translateY(0);
                }
            }

            .btn-ghost {
                background: rgba(255, 255, 255, 0.04);
                border-color: rgba(255, 255, 255, 0.12);
                color: #d4d4e8;

                &:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
            }

            .btn-solid {
                background: linear-gradient(135deg, #6366f1, #ec4899);
                color: #fff;

                &:hover {
                    box-shadow: 0 10px 26px rgba(99, 102, 241, 0.4);
                }
            }

            .btn-danger {
                background: rgba(239, 68, 68, 0.1);
                border-color: rgba(239, 68, 68, 0.3);
                color: #fca5a5;

                &:hover {
                    background: rgba(239, 68, 68, 0.18);
                }
            }
        }
    }

    .support {
        margin-top: 24px;
        font-size: 13px;
        color: #7c7c9c;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: center;
        animation: riseIn 0.6s ease 0.2s both;

        a {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #a5b4fc;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;

            &:hover {
                color: #f472b6;
            }
        }
    }
}

@media (max-width: 600px) {
    .unauthorized-page {
        .card {
            padding: 32px 24px;

            .title {
                font-size: 20px;
            }

            .subtitle {
                font-size: 13.5px;
            }
        }

        .actions .btn {
            flex: 1 1 auto;
            justify-content: center;
        }
    }
}
</style>